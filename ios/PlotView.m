// PlotView.m
#import <OpenGLES/ES3/gl.h>
#import <OpenGLES/ES3/glext.h>
#import "PlotView.h"
#import <React/RCTViewManager.h>
#import "ClusteringAndEllipsoids.h"
#import "FaissBridge.h"
#import "Algernon-Swift.h" // Import the Swift module

#define GLES_SILENCE_DEPRECATION

@implementation PlotViewManager

RCT_EXPORT_MODULE()

- (UIView *)view {
    return [[PlotView alloc] init];
}

@end

@interface PlotView ()

@property (nonatomic, strong) EAGLContext *context;
@property (nonatomic, strong) GLKBaseEffect *effect;
@property (nonatomic, strong) NSDictionary *clusteringResults;
@property (nonatomic, strong) NSArray *annotations;
@property (nonatomic, assign) GLfloat *vertices;
@property (nonatomic, assign) GLsizei vertexCount;
@property (nonatomic, assign) GLuint vertexArray;   // Declare vertexArray
@property (nonatomic, assign) GLuint vertexBuffer;  // Declare vertexBuffer
@property (nonatomic, assign) CGPoint lastTouchLocation;
@property (nonatomic, assign) GLKMatrix4 flipMatrix;
@property (nonatomic, assign) GLKMatrix4 rotationMatrix;
@property (nonatomic, assign) GLKMatrix4 projectionMatrix;
@property (nonatomic, assign) GLuint shaderProgram1;
@property (nonatomic, assign) GLuint shaderProgram2;

@property (nonatomic, strong) CADisplayLink *displayLink;

@property (nonatomic, assign) BOOL isCleaned;
@property (nonatomic, assign) BOOL isTouchActive;
@property (nonatomic, assign) BOOL isPIDRunning;

// PID coefficients
@property (nonatomic, assign) float kpPitch, kiPitch, kdPitch;
@property (nonatomic, assign) float kpYaw, kiYaw, kdYaw;
@property (nonatomic, assign) float kpRoll, kiRoll, kdRoll;

// PID state variables
@property (nonatomic, assign) float pitchIntegral, yawIntegral, rollIntegral;
@property (nonatomic, assign) float pitchDerivative, yawDerivative, rollDerivative;
@property (nonatomic, assign) float previousPitchError, previousYawError, previousRollError;

// Rotation velocities
@property (nonatomic, assign) float rotationPitchVelocity, rotationYawVelocity, rotationRollVelocity;

// Time tracking
@property (nonatomic, assign) CFTimeInterval previousTime;

@end

@implementation PlotView

- (instancetype)init {
    self = [super init];
    if (self) {
        [self setupGL];
        [self loadClusteringDataInBackground];
        self.rotationMatrix = GLKMatrix4Identity; // Initialize rotation matrix
        
        // Initialize PID coefficients
        float scale = 1.0f;
        self.kpPitch = 0.0f * scale;
        self.kiPitch = 0.1f * scale;
        self.kdPitch = 0.001f * scale;
        self.kpYaw = 0.0f * scale;
        self.kiYaw = 0.1f * scale;
        self.kdYaw = 0.001f * scale;
        self.kpRoll = 0.0f * scale;
        self.kiRoll = 0.1f * scale;
        self.kdRoll = 0.001f * scale;
        
        // Initialize PID state variables
        [self resetPIDVariables];

        // Initialize rotation velocities
        self.rotationPitchVelocity = 0.0f;
        self.rotationYawVelocity = 0.0f;
        self.rotationRollVelocity = 0.0f;
        
        self.isCleaned = NO;
        self.isTouchActive = NO; // Touch is not active initially
        self.isPIDRunning = NO;  // PID loop is not running initially
        self.previousTime = CACurrentMediaTime(); // Initialize time tracking
        
        self.displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(handleDisplayLink:)];
        [self.displayLink addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
    }
    return self;
}

- (void)resetPIDVariables {
    self.pitchIntegral = 0.0f; self.yawIntegral = 0.0f; self.rollIntegral = 0.0f;
    self.pitchDerivative = 0.0f; self.yawDerivative = 0.0f; self.rollDerivative = 0.0f;
    self.previousPitchError = 0.0f; self.previousYawError = 0.0f; self.previousRollError = 0.0f;
}

- (void)handleDisplayLink:(CADisplayLink *)displayLink {
    if (self.isPIDRunning) {
//        [self updateRotationMatrix];
        [self setNeedsDisplay]; // Request a redraw
    }
}

- (void)loadClusteringDataInBackground {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        //        [self loadClusteringData];
        [self loadTestData];
    });
}

- (void)loadTestData {
    @try {
        NSString *path = [[NSBundle mainBundle] pathForResource:@"iris_dataset" ofType:@"csv"];
        NSError *error = nil;
        NSString *content = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:&error];
        
        if (error) {
            NSLog(@"Failed to read file: %@", error.localizedDescription);
            return;
        }
        
        NSArray *rows = [content componentsSeparatedByString:@"\n"];
        if (rows.count <= 1) {
            NSLog(@"CSV file doesn't contain enough rows.");
            return;
        }
        
        int rowsCount = (int)rows.count - 2; // Exclude header row and last row
        int colsCount = 4; // we have 4 features
        
        float *data = (float *)malloc(rowsCount * colsCount * sizeof(float));
        if (data == NULL) {
            NSLog(@"Failed to allocate memory for data array.");
            return;
        }
        
        int index = 0;
        
        for (int i = 1; i < rows.count - 1; i++) { // start from 1 to skip header and stop before the last row
            NSString *row = rows[i];
            NSArray *cols = [row componentsSeparatedByString:@","];
            
            if (cols.count < 5) {
                NSLog(@"Row %d doesn't contain enough columns or is invalid.", i);
                continue;
            }
            
            for (int j = 0; j < colsCount; j++) {
                data[index++] = [cols[j] floatValue];
            }
        }
        
        NSLog(@"IRIS Data:");
        for (int i = 0; i < rowsCount; ++i) {
            NSMutableString *dataString = [NSMutableString string];
            for (int j = 0; j < colsCount; ++j) {
                [dataString appendFormat:@"%f ", data[i * colsCount + j]];
            }
            NSLog(@"%@", dataString);
        }
        
        ClusteringAndEllipsoids *clusteringAndEllipsoids = [[ClusteringAndEllipsoids alloc] init];
        self.clusteringResults = [clusteringAndEllipsoids performClusteringAndEllipsoids:data rows:rowsCount cols:colsCount];
        
        // Trigger a redraw to render the ellipsoid
        dispatch_async(dispatch_get_main_queue(), ^{
            [self setNeedsDisplay];
        });
        
        // Free allocated memory
        free(data);
    }
    @catch (NSException *exception) {
        NSLog(@"An error occurred: %@\nStack trace: %@", exception.reason, exception.callStackSymbols);
    }
}

- (void)loadClusteringData {
    NSLog(@"Loading PlotView data");
    
    FaissBridge *faissBridge = [FaissBridge sharedInstance];
    NSDictionary *faissData = [faissBridge getVectors];
    
    if (faissData) {
        int ntotal = [faissData[@"ntotal"] intValue];
        int dimension = [faissData[@"dimension"] intValue];
        float *database = [faissData[@"database"] pointerValue];
        
        NSLog(@"ntotal: %d, dimension: %d", ntotal, dimension);
        
        // Print vectors
        for (int i = 0; i < ntotal; i++) {
            NSMutableString *vectorString = [NSMutableString stringWithString:@"Vector: "];
            for (int j = 0; j < dimension; j++) {
                [vectorString appendFormat:@"%f ", database[i * dimension + j]];
            }
            NSLog(@"%@", vectorString);
        }
        
        ClusteringAndEllipsoids *clustering = [[ClusteringAndEllipsoids alloc] init];
        self.clusteringResults = [clustering performClusteringAndEllipsoids:database rows:ntotal cols:dimension];
        
        // Print clustering results labels
        int *bestLabels = [(NSValue *)self.clusteringResults[@"bestLabels"] pointerValue];
        for (int i = 0; i < ntotal; i++) {
            NSLog(@"Label[%d]: %d", i, bestLabels[i]);
        }
        
        // Print reduced data
        float *reducedData = [(NSValue *)self.clusteringResults[@"reducedData"] pointerValue];
        int reducedDim = 3; // Assuming the reduced dimension is 3
        for (int i = 0; i < ntotal; i++) {
            NSMutableString *reducedDataString = [NSMutableString stringWithString:@"Reduced Data: "];
            for (int j = 0; j < reducedDim; j++) {
                [reducedDataString appendFormat:@"%f ", reducedData[i * reducedDim + j]];
            }
            NSLog(@"%@", reducedDataString);
        }
        
        NSMutableArray *ellipsoids = self.clusteringResults[@"bestEllipsoids"];
        for (NSDictionary *ellipsoid in ellipsoids) {
            NSLog(@"Mean: %@", ellipsoid[@"mean"]);
            NSLog(@"Eigenvalues: %@", ellipsoid[@"eigenvalues"]);
            NSLog(@"Eigenvectors: %@", ellipsoid[@"eigenvectors"]);
        }
        
        // Trigger a redraw to render the ellipsoid
        dispatch_async(dispatch_get_main_queue(), ^{
            [self setNeedsDisplay];
        });
        
        free(database);
        
        // Load annotations after clustering
        //        [self loadAnnotations];
    } else {
        NSLog(@"Failed to load data from FAISS");
    }
}

- (void)loadAnnotations {
    DatabaseModule *databaseModule = [DatabaseModule new];
    [databaseModule fetchAnnotations:^(NSArray *results) {
        self.annotations = results;
        
        // Print annotations
        for (NSDictionary *annotation in results) {
            NSLog(@"Annotation: %@", annotation);
        }
        
        // Perform rendering on the main thread
        dispatch_async(dispatch_get_main_queue(), ^{
            [self setNeedsDisplay];
        });
    } reject:^(NSString *code, NSString *message, NSError *error) {
        NSLog(@"Error loading annotations: %@", message);
    }];
}

- (void)setupGL {
    self.context = [[EAGLContext alloc] initWithAPI:kEAGLRenderingAPIOpenGLES3];
    if (!self.context) {
        NSLog(@"Failed to create ES context");
    }
    
    [EAGLContext setCurrentContext:self.context];
    
    // Initialize shaders and program
    [self setupShaders];
    glEnable(GL_DEPTH_TEST);
    
    // Setup projection matrix
    //    float aspectRatio = self.bounds.size.width / self.bounds.size.height;
    float size = 1.7f;
    self.projectionMatrix = GLKMatrix4MakeOrtho(-size, size, -size, size, -size, size);
    self.flipMatrix = GLKMatrix4Make(
                                     1.0f, 0.0f,  0.0f, 0.0f,
                                     0.0f, 0.0f, -1.0f, 0.0f,
                                     0.0f, 1.0f,  0.0f, 0.0f,
                                     0.0f, 0.0f,  0.0f, 1.0f
                                     );
}

- (void)setupShaders {
    const GLchar *vertexShaderSource = "#version 300 es\n"
    "layout(location = 0) in vec3 aPos;\n"
    "out vec3 vertexCorner;\n"
    "uniform mat4 uModelViewProjectionMatrix;\n"
    "void main() {\n"
    "   gl_Position = uModelViewProjectionMatrix * vec4(aPos, 1.0);\n"
    "   vertexCorner = aPos;\n"
    "   gl_PointSize = 10.0;\n" // Set the point size here
    "}\n";
    
    const GLchar *fragmentShaderSource = "#version 300 es\n"
    "precision mediump float;\n"
    "uniform vec2 u_center;\n"
    "uniform mat2 u_covInv;\n"
    "uniform float u_amplitude;\n"
    "uniform vec3 u_color;\n"
    "in vec3 vertexCorner;\n"
    "out vec4 FragColor;\n"
    "void main() {\n"
    "   vec2 uv = vertexCorner.xy;\n"
    "   vec2 delta = uv - u_center;\n"
    "   float distSquared = dot(delta * u_covInv, delta);\n"
    "   float gaussian = u_amplitude * exp(-0.5 * distSquared);\n"
    "   FragColor = vec4(u_color, gaussian);\n"
    "}\n";
    
    GLuint vertexShader = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);
    glCompileShader(vertexShader);
    [self checkShaderCompilation:vertexShader];
    
    GLuint fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
    glCompileShader(fragmentShader);
    [self checkShaderCompilation:fragmentShader];
    
    self.shaderProgram1 = glCreateProgram();
    glAttachShader(self.shaderProgram1, vertexShader);
    glAttachShader(self.shaderProgram1, fragmentShader);
    glLinkProgram(self.shaderProgram1);
    [self checkProgramLinking:self.shaderProgram1];
    
    glDeleteShader(vertexShader);
    glDeleteShader(fragmentShader);
    
    // Second Shader Program
    const GLchar *vertexShaderSource2 = "#version 300 es\n"
    "layout(location = 0) in vec3 aPos;\n"
    "layout(location = 1) in vec3 aColor;\n"
    "out vec3 vertexColor;\n"
    "uniform mat4 uModelViewProjectionMatrix;\n"
    "void main() {\n"
    "   gl_Position = uModelViewProjectionMatrix * vec4(aPos, 1.0);\n"
    "   gl_PointSize = 7.0;\n" // Set the point size here
    "   vertexColor = aColor;\n"
    "}\n";
    
    const GLchar *fragmentShaderSource2 = "#version 300 es\n"
    "precision mediump float;\n"
    "in vec3 vertexColor;\n"
    "out vec4 FragColor;\n"
    "void main() {\n"
    "   FragColor = vec4(vertexColor, 1.0);\n"
    "}\n";
    
    GLuint vertexShader2 = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(vertexShader2, 1, &vertexShaderSource2, NULL);
    glCompileShader(vertexShader2);
    [self checkShaderCompilation:vertexShader2];
    
    GLuint fragmentShader2 = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(fragmentShader2, 1, &fragmentShaderSource2, NULL);
    glCompileShader(fragmentShader2);
    [self checkShaderCompilation:fragmentShader2];
    
    self.shaderProgram2 = glCreateProgram();
    glAttachShader(self.shaderProgram2, vertexShader2);
    glAttachShader(self.shaderProgram2, fragmentShader2);
    glLinkProgram(self.shaderProgram2);
    [self checkProgramLinking:self.shaderProgram2];
    
    glDeleteShader(vertexShader2);
    glDeleteShader(fragmentShader2);
}

- (void)drawRect:(CGRect)rect {
    [self updateRotationMatrix];
    
    CGFloat scale = [UIScreen mainScreen].scale;
    glViewport(0, 0, self.bounds.size.width * scale, self.bounds.size.height * scale);
    
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);  // Set the clear color to white
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    
    GLKMatrix4 modelViewProjectionMatrix = GLKMatrix4Multiply(self.projectionMatrix, self.rotationMatrix);
    
    // Apply the projection matrix and rotation matrix
    glUseProgram(self.shaderProgram2);
    GLuint mvpMatrixLocation2 = glGetUniformLocation(self.shaderProgram2, "uModelViewProjectionMatrix");
    glUniformMatrix4fv(mvpMatrixLocation2, 1, GL_FALSE, modelViewProjectionMatrix.m);
    
    // Draw the crosshair and reduced data
    
    
    
    [self drawReducedData];
    [self drawCrosshair];
    //    [self drawPointAtPositionX:0.5f y:0.5f z:0.5f withColorR:1.0f g:0.0f b:0.0f];
    //    [self drawBillboardAtPositionX:0.5f y:0.5f z:0.5f withSize:0.1f andColorR:1.0f g:0.0f b:0.0f]; // Red billboard at the origin
    //    [self drawEllipsoidAxes];
//    glUseProgram(self.shaderProgram1);
//    GLuint mvpMatrixLocation1 = glGetUniformLocation(self.shaderProgram1, "uModelViewProjectionMatrix");
//    glUniformMatrix4fv(mvpMatrixLocation1, 1, GL_FALSE, modelViewProjectionMatrix.m);
    [self drawGaussians];
}

- (void)drawCrosshair {
    GLKVector3 cameraRight = GLKVector3Make(1, 0, 0);
    GLKVector3 cameraUp = GLKVector3Make(0, 1, 0);
    GLKVector3 cameraForward = GLKVector3Make(0, 0, 1);
    
    cameraRight = GLKMatrix4MultiplyVector3(self.flipMatrix, cameraRight);
    cameraUp = GLKMatrix4MultiplyVector3(self.flipMatrix, cameraUp);
    cameraForward = GLKMatrix4MultiplyVector3(self.flipMatrix, cameraForward);
    
    // Define the crosshair vertices and colors
    GLfloat vertices[] = {
        // X axis (negative part black, positive part red)
        -cameraRight.x, -cameraRight.y, -cameraRight.z,  0.0f, 0.0f, 0.0f,  // Start point (black)
        cameraRight.x, cameraRight.y, cameraRight.z,  1.0f, 0.0f, 0.0f,  // End point (red)
        // Y axis (negative part black, positive part green)
        -cameraUp.x, -cameraUp.y, -cameraUp.z,  0.0f, 0.0f, 0.0f,  // Start point (black)
        cameraUp.x, cameraUp.y, cameraUp.z,  0.0f, 0.0f, 1.0f,  // End point (green)
        // Z axis (negative part black, positive part blue)
        -cameraForward.x, -cameraForward.y, -cameraForward.z,  0.0f, 0.0f, 0.0f,  // Start point (black)
        cameraForward.x, cameraForward.y, cameraForward.z,  0.0f, 1.0f, 0.0f   // End point (blue)
    };

    GLKMatrix4 modelViewProjectionMatrix = GLKMatrix4Multiply(self.projectionMatrix, self.rotationMatrix);
    [self drawLines:vertices n:6 e:6 mvp:modelViewProjectionMatrix];
    
    // Set up vertex array and buffer
//    glGenVertexArrays(1, &_vertexArray);
//    glGenBuffers(1, &_vertexBuffer);
//    
//    glBindVertexArray(self.vertexArray);
//    
//    glBindBuffer(GL_ARRAY_BUFFER, self.vertexBuffer);
//    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
//    
//    // Position attribute
//    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(GLfloat), (GLvoid *)0);
//    glEnableVertexAttribArray(0);
//    
//    // Color attribute
//    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(GLfloat), (GLvoid *)(3 * sizeof(GLfloat)));
//    glEnableVertexAttribArray(1);
//    
//    glBindBuffer(GL_ARRAY_BUFFER, 0);
//    
//    // Draw the 3D crosshair
//    glDrawArrays(GL_LINES, 0, self.vertexCount);
//    
//    // Cleanup
//    glBindVertexArray(0);
//    glDeleteVertexArrays(1, &_vertexArray);
//    glDeleteBuffers(1, &_vertexBuffer);
}

// Add this function to draw a single point with a specified size
- (void)drawPointAtPositionX:(GLfloat)x y:(GLfloat)y z:(GLfloat)z withColorR:(GLfloat)r g:(GLfloat)g b:(GLfloat)b {
    GLfloat pointVertices[] = {
        x, y, z,  // Position
    };
    
    GLfloat pointColors[] = {
        r, g, b,  // Color
    };
    
    GLuint pointVAO, pointVBO, colorVBO;
    glGenVertexArrays(1, &pointVAO);
    glGenBuffers(1, &pointVBO);
    glGenBuffers(1, &colorVBO);
    
    glBindVertexArray(pointVAO);
    
    glBindBuffer(GL_ARRAY_BUFFER, pointVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(pointVertices), pointVertices, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(GLfloat), (GLvoid *)0);
    glEnableVertexAttribArray(0);
    
    glBindBuffer(GL_ARRAY_BUFFER, colorVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(pointColors), pointColors, GL_STATIC_DRAW);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(GLfloat), (GLvoid *)0);
    glEnableVertexAttribArray(1);
    
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    
    // Draw the point
    glDrawArrays(GL_POINTS, 0, 1);
    
    // Cleanup
    glBindVertexArray(0);
    glDeleteVertexArrays(1, &pointVAO);
    glDeleteBuffers(1, &pointVBO);
    glDeleteBuffers(1, &colorVBO);
}

- (void)drawReducedData {
    if (!self.clusteringResults) {
        return; // Exit early if clustering results are not available
    }
    
    // Retrieve reduced data and labels
    float *reducedData = [(NSValue *)self.clusteringResults[@"reducedData"] pointerValue];
    int *labels = [(NSValue *)self.clusteringResults[@"bestLabels"] pointerValue];
    int rowsCount = [(NSNumber *)self.clusteringResults[@"rows"] intValue];
    
    // Generate vertex data and colors based on labels
    GLfloat *vertices = (GLfloat *)malloc(rowsCount * 3 * sizeof(GLfloat));
    GLfloat *colors = (GLfloat *)malloc(rowsCount * 3 * sizeof(GLfloat));
    
    // Create the transformation matrix to swap y and z and flip z
    GLKMatrix4 transformMatrix = GLKMatrix4Make(
                                                1.0f, 0.0f,  0.0f, 0.0f,
                                                0.0f, 0.0f, -1.0f, 0.0f,
                                                0.0f, 1.0f,  0.0f, 0.0f,
                                                0.0f, 0.0f,  0.0f, 1.0f
                                                );
    
    for (int i = 0; i < rowsCount; i++) {
        GLKVector3 originalVertex = GLKVector3Make(reducedData[i * 3 + 0],
                                                   reducedData[i * 3 + 1],
                                                   reducedData[i * 3 + 2]);
        
        // Apply the transformation matrix
        GLKVector3 transformedVertex = GLKMatrix4MultiplyVector3(transformMatrix, originalVertex);
        
        // Store the transformed vertex
        vertices[i * 3 + 0] = transformedVertex.x;
        vertices[i * 3 + 1] = transformedVertex.y;
        vertices[i * 3 + 2] = transformedVertex.z;
        
        // Print the transformed data values
        //        NSLog(@"Transformed Data [%d]: x=%f, y=%f, z=%f", i, vertices[i * 3 + 0], vertices[i * 3 + 1], vertices[i * 3 + 2]);
        
        // Assign colors based on labels (for simplicity, map labels 0, 1, 2 to red, green, blue)
        switch (labels[i]) {
            case 0:
                colors[i * 3 + 0] = 1.0f; // Red
                colors[i * 3 + 1] = 0.0f;
                colors[i * 3 + 2] = 0.0f;
                break;
            case 1:
                colors[i * 3 + 0] = 0.0f;
                colors[i * 3 + 1] = 0.0f; // Green
                colors[i * 3 + 2] = 1.0f;
                break;
            case 2:
                colors[i * 3 + 0] = 0.0f;
                colors[i * 3 + 1] = 1.0f;
                colors[i * 3 + 2] = 0.0f; // Blue
                break;
            default:
                colors[i * 3 + 0] = 0.0f;
                colors[i * 3 + 1] = 0.0f;
                colors[i * 3 + 2] = 0.0f; // Black for other labels
                break;
        }
    }
    
    // Set up vertex array and buffer for reduced data
    GLuint dataVAO, dataVBO, colorVBO;
    glGenVertexArrays(1, &dataVAO);
    glGenBuffers(1, &dataVBO);
    glGenBuffers(1, &colorVBO);
    
    glBindVertexArray(dataVAO);
    
    glBindBuffer(GL_ARRAY_BUFFER, dataVBO);
    glBufferData(GL_ARRAY_BUFFER, rowsCount * 3 * sizeof(GLfloat), vertices, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(GLfloat), (GLvoid *)0);
    glEnableVertexAttribArray(0);
    
    glBindBuffer(GL_ARRAY_BUFFER, colorVBO);
    glBufferData(GL_ARRAY_BUFFER, rowsCount * 3 * sizeof(GLfloat), colors, GL_STATIC_DRAW);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(GLfloat), (GLvoid *)0);
    glEnableVertexAttribArray(1);
    
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    
    // Draw the reduced data points
    glDrawArrays(GL_POINTS, 0, rowsCount);
    
    // Cleanup
    glBindVertexArray(0);
    glDeleteVertexArrays(1, &dataVAO);
    glDeleteBuffers(1, &dataVBO);
    glDeleteBuffers(1, &colorVBO);
    
    free(vertices);
    free(colors);
}

- (void)drawBillboardAtPositionX:(GLfloat)x y:(GLfloat)y z:(GLfloat)z withSize:(GLfloat)size andColorR:(GLfloat)r g:(GLfloat)g b:(GLfloat)b {
    GLfloat halfSize = size / 2.0f;
    
    // Create the center vector and apply the rotation matrix to it
    GLKVector4 center = GLKVector4Make(x, y, z, 1.0f);
    center = GLKMatrix4MultiplyVector4(self.rotationMatrix, center);
    
    // Extract the camera right and up vectors from the rotation matrix
    GLKVector3 cameraRight = GLKVector3Make(1, 0, 0);
    GLKVector3 cameraUp = GLKVector3Make(0, 1, 0);
    //    GLKVector3 cameraRight = GLKVector3Make(self.rotationMatrix.m00, self.rotationMatrix.m10, self.rotationMatrix.m20);
    //    GLKVector3 cameraUp = GLKVector3Make(self.rotationMatrix.m01, self.rotationMatrix.m11, self.rotationMatrix.m21);
    
    // Calculate the four corners of the billboard
    GLKVector3 bottomLeft = GLKVector3Subtract(GLKVector3Subtract(GLKVector3Make(center.x, center.y, center.z), GLKVector3MultiplyScalar(cameraRight, halfSize)), GLKVector3MultiplyScalar(cameraUp, halfSize));
    GLKVector3 bottomRight = GLKVector3Add(GLKVector3Subtract(GLKVector3Make(center.x, center.y, center.z), GLKVector3MultiplyScalar(cameraUp, halfSize)), GLKVector3MultiplyScalar(cameraRight, halfSize));
    GLKVector3 topLeft = GLKVector3Subtract(GLKVector3Add(GLKVector3Make(center.x, center.y, center.z), GLKVector3MultiplyScalar(cameraUp, halfSize)), GLKVector3MultiplyScalar(cameraRight, halfSize));
    GLKVector3 topRight = GLKVector3Add(GLKVector3Add(GLKVector3Make(center.x, center.y, center.z), GLKVector3MultiplyScalar(cameraUp, halfSize)), GLKVector3MultiplyScalar(cameraRight, halfSize));
    
    // Define the billboard vertices (two triangles forming a square)
    GLfloat vertices[] = {
        // First triangle
        bottomLeft.x, bottomLeft.y, bottomLeft.z,  r, g, b, // Bottom-left
        bottomRight.x, bottomRight.y, bottomRight.z,  r, g, b, // Bottom-right
        topRight.x, topRight.y, topRight.z,  r, g, b, // Top-right
        
        // Second triangle
        bottomLeft.x, bottomLeft.y, bottomLeft.z,  r, g, b, // Bottom-left
        topRight.x, topRight.y, topRight.z,  r, g, b, // Top-right
        topLeft.x, topLeft.y, topLeft.z,  r, g, b  // Top-left
    };
    
    // Generate the translation matrix to move the billboard to the desired position
    //    GLKMatrix4 translationMatrix = GLKMatrix4MakeTranslation(center.x, center.y, center.z);
    
    // Combine the translation and rotation matrix to get the final model matrix
    //    GLKMatrix4 modelMatrix = GLKMatrix4Multiply(translationMatrix, self.rotationMatrix);
    //    GLKMatrix4 mvpMatrix = GLKMatrix4Multiply(self.projectionMatrix, modelMatrix);
    GLKMatrix4 mvpMatrix = self.projectionMatrix;
    
    GLuint mvpMatrixLocation = glGetUniformLocation(self.shaderProgram1, "uModelViewProjectionMatrix");
    glUniformMatrix4fv(mvpMatrixLocation, 1, GL_FALSE, mvpMatrix.m);
    
    GLuint billboardVAO, billboardVBO;
    glGenVertexArrays(1, &billboardVAO);
    glGenBuffers(1, &billboardVBO);
    
    glBindVertexArray(billboardVAO);
    
    glBindBuffer(GL_ARRAY_BUFFER, billboardVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
    
    // Position attribute
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(GLfloat), (GLvoid *)0);
    glEnableVertexAttribArray(0);
    
    // Color attribute
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(GLfloat), (GLvoid *)(3 * sizeof(GLfloat)));
    glEnableVertexAttribArray(1);
    
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    
    // Draw the billboard
    glDrawArrays(GL_TRIANGLES, 0, 6);
    
    // Cleanup
    glBindVertexArray(0);
    glDeleteVertexArrays(1, &billboardVAO);
    glDeleteBuffers(1, &billboardVBO);
}

- (void)drawEllipsoidAxes {
    if (!self.clusteringResults) {
        return; // Exit early if clustering results are not available
    }
    
    NSMutableArray *ellipsoids = self.clusteringResults[@"bestEllipsoids"];
    
    // Transformation matrix to swap y and z, and flip z
    GLKMatrix4 transformMatrix = GLKMatrix4Make(
                                                1.0f, 0.0f,  0.0f, 0.0f,
                                                0.0f, 0.0f, -1.0f, 0.0f,
                                                0.0f, 1.0f,  0.0f, 0.0f,
                                                0.0f, 0.0f,  0.0f, 1.0f
                                                );
    
    for (NSDictionary *ellipsoid in ellipsoids) {
        NSArray *mean = ellipsoid[@"mean"];
        NSArray *eigenvalues = ellipsoid[@"eigenvalues"];
        NSArray *eigenvectors = ellipsoid[@"eigenvectors"];
        
        // Center of the ellipsoid
        GLKVector3 center = GLKVector3Make([mean[0] floatValue],
                                           [mean[1] floatValue],
                                           [mean[2] floatValue]);
        
        // Semi-axes
        GLKVector3 semiAxis1 = GLKVector3MultiplyScalar(GLKVector3Make([eigenvectors[0][0] floatValue],
                                                                       [eigenvectors[1][0] floatValue],
                                                                       [eigenvectors[2][0] floatValue]),
                                                        sqrtf([eigenvalues[0] floatValue]));
        
        GLKVector3 semiAxis2 = GLKVector3MultiplyScalar(GLKVector3Make([eigenvectors[0][1] floatValue],
                                                                       [eigenvectors[1][1] floatValue],
                                                                       [eigenvectors[2][1] floatValue]),
                                                        sqrtf([eigenvalues[1] floatValue]));
        
        GLKVector3 semiAxis3 = GLKVector3MultiplyScalar(GLKVector3Make([eigenvectors[0][2] floatValue],
                                                                       [eigenvectors[1][2] floatValue],
                                                                       [eigenvectors[2][2] floatValue]),
                                                        sqrtf([eigenvalues[2] floatValue]));
        
        // Transform the center
        center = GLKMatrix4MultiplyVector3(transformMatrix, center);
        
        // Transform the semi-axes
        semiAxis1 = GLKMatrix4MultiplyVector3(transformMatrix, semiAxis1);
        semiAxis2 = GLKMatrix4MultiplyVector3(transformMatrix, semiAxis2);
        semiAxis3 = GLKMatrix4MultiplyVector3(transformMatrix, semiAxis3);
        
        // Calculate the start and end points for each axis
        GLKVector3 axis1Start = GLKVector3Subtract(center, semiAxis1);
        GLKVector3 axis1End = GLKVector3Add(center, semiAxis1);
        GLKVector3 axis2Start = GLKVector3Subtract(center, semiAxis2);
        GLKVector3 axis2End = GLKVector3Add(center, semiAxis2);
        GLKVector3 axis3Start = GLKVector3Subtract(center, semiAxis3);
        GLKVector3 axis3End = GLKVector3Add(center, semiAxis3);
        
        // Collect the vertices
        GLfloat axesVertices[] = {
            axis1Start.x, axis1Start.y, axis1Start.z,
            axis1End.x, axis1End.y, axis1End.z,
            
            axis2Start.x, axis2Start.y, axis2Start.z,
            axis2End.x, axis2End.y, axis2End.z,
            
            axis3Start.x, axis3Start.y, axis3Start.z,
            axis3End.x, axis3End.y, axis3End.z
        };
        
        // Set up vertex array and buffer for Gaussian axes
        GLuint axesVAO, axesVBO;
        glGenVertexArrays(1, &axesVAO);
        glGenBuffers(1, &axesVBO);
        
        glBindVertexArray(axesVAO);
        
        glBindBuffer(GL_ARRAY_BUFFER, axesVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(axesVertices), axesVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(GLfloat), (GLvoid *)0);
        glEnableVertexAttribArray(0);
        
        glBindBuffer(GL_ARRAY_BUFFER, 0);
        
        // Draw the Gaussian axes
        glDrawArrays(GL_LINES, 0, 6);
        
        // Cleanup
        glBindVertexArray(0);
        glDeleteVertexArrays(1, &axesVAO);
        glDeleteBuffers(1, &axesVBO);
    }
}

- (void)drawGaussians {
    if (!self.clusteringResults) {
        return; // Exit early if clustering results are not available
    }
    
    NSMutableArray *ellipsoids = self.clusteringResults[@"bestEllipsoids"];
    
    // Transformation matrix to swap y and z, and flip z
    GLKMatrix4 transformMatrix = self.flipMatrix;
    
    // Combine the projection, view, and model matrices into an MVP matrix
    GLKMatrix4 mvpMatrix = GLKMatrix4Multiply(self.projectionMatrix, self.rotationMatrix);
    
    NSInteger index = -1;
    for (NSDictionary *ellipsoid in ellipsoids) {
        index++;
        
        NSArray *mean = ellipsoid[@"mean"];
        NSArray *eigenvalues = ellipsoid[@"eigenvalues"];
        NSArray *eigenvectors = ellipsoid[@"eigenvectors"];
        NSArray *covariance3 = ellipsoid[@"covariance"];
        
        float covariance[3][3];
        NSArray *covarianceArray = ellipsoid[@"covariance"];
        for (int i = 0; i < 3; ++i) {
            for (int j = 0; j < 3; ++j) {
                covariance[i][j] = [covarianceArray[i][j] floatValue];
            }
        }
        GLKMatrix4 transformRotationMatrix = GLKMatrix4Multiply(self.rotationMatrix, self.flipMatrix);
        // Convert the 3x3 covariance matrix to a 4x4 matrix
        GLKMatrix4 covariance4x4 = GLKMatrix4Identity;
        covariance4x4.m00 = covariance[0][0];
        covariance4x4.m01 = covariance[0][1];
        covariance4x4.m02 = covariance[0][2];
        covariance4x4.m10 = covariance[1][0];
        covariance4x4.m11 = covariance[1][1];
        covariance4x4.m12 = covariance[1][2];
        covariance4x4.m20 = covariance[2][0];
        covariance4x4.m21 = covariance[2][1];
        covariance4x4.m22 = covariance[2][2];
        // Apply the combined transformation
        GLKMatrix4 transformedCovariance = GLKMatrix4Multiply(transformRotationMatrix, GLKMatrix4Multiply(covariance4x4, GLKMatrix4Transpose(transformRotationMatrix)));
        float covariance3x3[3][3];
        covariance3x3[0][0] = transformedCovariance.m00;
        covariance3x3[0][1] = transformedCovariance.m01;
        covariance3x3[0][2] = transformedCovariance.m02;
        covariance3x3[1][0] = transformedCovariance.m10;
        covariance3x3[1][1] = transformedCovariance.m11;
        covariance3x3[1][2] = transformedCovariance.m12;
        covariance3x3[2][0] = transformedCovariance.m20;
        covariance3x3[2][1] = transformedCovariance.m21;
        covariance3x3[2][2] = transformedCovariance.m22;
        
        GLKVector3 cameraForward = GLKVector3Make(0, 0, 1);
        cameraForward = GLKMatrix4MultiplyVector3(transformRotationMatrix, cameraForward);
        
        float cameraForwardFloat[3];
        cameraForwardFloat[0] = 0;
        cameraForwardFloat[1] = 0;
        cameraForwardFloat[2] = 1;
        
        float greatestVariance = fmax(fmax([eigenvalues[0] floatValue], [eigenvalues[1] floatValue]), [eigenvalues[2] floatValue]);
        float currentZVariance = [ClusteringAndEllipsoids getVarianceAlongDirection:cameraForwardFloat covarianceMatrix:covariance3x3];
        float ratio = sqrtf(currentZVariance) / sqrtf(greatestVariance);
        float determinant3x3 = [ellipsoid[@"determinant"] floatValue];
        // Volume, in n-dimensions, scales with the sqrt(det(cov)).
        float area = sqrtf(determinant3x3);
        ratio = ratio * area;
        ratio = 0.7f * ratio + 0.3f;
        
//        NSLog(@"greatestVariance: %f", sqrtf(greatestVariance));
//        NSLog(@"currentZVariance: %f", sqrtf(currentZVariance));
//        NSLog(@"ratio: %f", ratio);
        
        // Extract the top-left 2x2 part of the transformed covariance matrix
        float sigmaXX = transformedCovariance.m00;
        float sigmaXY = transformedCovariance.m01;
        float sigmaYX = transformedCovariance.m10;
        float sigmaYY = transformedCovariance.m11;
        
        // Set up the 2x2 covariance matrix
        float covariance2x2[2][2] = {
            {sigmaXX, sigmaXY},
            {sigmaYX, sigmaYY}
        };
        
        // Print 2x2 covariance matrix
//        NSLog(@"%f, %f\n%f %f", sigmaXX, sigmaXY, sigmaYX, sigmaYY);
        
        NSDictionary *decomposition2x2 = [ClusteringAndEllipsoids decompose2x2:covariance2x2];
        NSArray *eigenvalues2x2 = decomposition2x2[@"eigenvalues"];
        NSArray *eigenvectors2x2 = decomposition2x2[@"eigenvectors"];
        
        NSDictionary *decomposition3x3 = [ClusteringAndEllipsoids decompose3x3:covariance3x3];
        NSArray *eigenvalues3x3 = decomposition3x3[@"eigenvalues"];
        NSArray *eigenvectors3x3 = decomposition3x3[@"eigenvectors"];
        
//        NSLog(@"dot products: %f %f %f", dotProducts[0], dotProducts[1], dotProducts[2]);
        
        
        GLKVector2 semimajor;
        GLKVector2 semiminor;
        if (eigenvalues2x2[0] > eigenvalues2x2[1]) {
            semimajor = GLKVector2MultiplyScalar(GLKVector2Make([eigenvectors2x2[0][0] floatValue], [eigenvectors2x2[0][1] floatValue]), sqrtf([eigenvalues2x2[0] floatValue]));
            semiminor = GLKVector2MultiplyScalar(GLKVector2Make([eigenvectors2x2[1][0] floatValue], [eigenvectors2x2[1][1] floatValue]), sqrtf([eigenvalues2x2[1] floatValue]));
        } else {
            semiminor = GLKVector2MultiplyScalar(GLKVector2Make([eigenvectors2x2[0][0] floatValue], [eigenvectors2x2[0][1] floatValue]), sqrtf([eigenvalues2x2[0] floatValue]));
            semimajor = GLKVector2MultiplyScalar(GLKVector2Make([eigenvectors2x2[1][0] floatValue], [eigenvectors2x2[1][1] floatValue]), sqrtf([eigenvalues2x2[1] floatValue]));
        }
        
//        NSLog(@"semimajor: %f, %f", semimajor.x, semimajor.y);
//        NSLog(@"semiminor: %f, %f", semiminor.x, semiminor.y);
        
        // Apply transformations to the covariance matrix:
        
        
        // Center of the ellipsoid
        GLKVector3 center = GLKVector3Make([mean[0] floatValue],
                                           [mean[1] floatValue],
                                           [mean[2] floatValue]);
        
        // Semi-axes
        GLKVector3 semiAxis1 = GLKVector3MultiplyScalar(GLKVector3Make([eigenvectors[0][0] floatValue],
                                                                       [eigenvectors[1][0] floatValue],
                                                                       [eigenvectors[2][0] floatValue]),
                                                        sqrtf([eigenvalues[0] floatValue]));
        
        GLKVector3 semiAxis2 = GLKVector3MultiplyScalar(GLKVector3Make([eigenvectors[0][1] floatValue],
                                                                       [eigenvectors[1][1] floatValue],
                                                                       [eigenvectors[2][1] floatValue]),
                                                        sqrtf([eigenvalues[1] floatValue]));
        
        GLKVector3 semiAxis3 = GLKVector3MultiplyScalar(GLKVector3Make([eigenvectors[0][2] floatValue],
                                                                       [eigenvectors[1][2] floatValue],
                                                                       [eigenvectors[2][2] floatValue]),
                                                        sqrtf([eigenvalues[2] floatValue]));
        
        // Transform the center
        center = GLKMatrix4MultiplyVector3(transformMatrix, center);
        
        // Transform the semi-axes
        semiAxis1 = GLKMatrix4MultiplyVector3(transformMatrix, semiAxis1);
        semiAxis2 = GLKMatrix4MultiplyVector3(transformMatrix, semiAxis2);
        semiAxis3 = GLKMatrix4MultiplyVector3(transformMatrix, semiAxis3);
        
        // Apply the MVP matrix to the center and semi-axes
        GLKVector4 transformedCenter = GLKMatrix4MultiplyVector4(mvpMatrix, GLKVector4Make(center.x, center.y, center.z, 1.0));
        GLKVector4 transformedAxis1 = GLKMatrix4MultiplyVector4(mvpMatrix, GLKVector4Make(semiAxis1.x, semiAxis1.y, semiAxis1.z, 0.0));
        GLKVector4 transformedAxis2 = GLKMatrix4MultiplyVector4(mvpMatrix, GLKVector4Make(semiAxis2.x, semiAxis2.y, semiAxis2.z, 0.0));
        GLKVector4 transformedAxis3 = GLKMatrix4MultiplyVector4(mvpMatrix, GLKVector4Make(semiAxis3.x, semiAxis3.y, semiAxis3.z, 0.0));
        
        // Calculate the start and end points for each transformed axis
        GLKVector3 axis1Start = GLKVector3Subtract(GLKVector3Make(transformedCenter.x, transformedCenter.y, transformedCenter.z), GLKVector3Make(transformedAxis1.x, transformedAxis1.y, transformedAxis1.z));
        GLKVector3 axis1End = GLKVector3Add(GLKVector3Make(transformedCenter.x, transformedCenter.y, transformedCenter.z), GLKVector3Make(transformedAxis1.x, transformedAxis1.y, transformedAxis1.z));
        GLKVector3 axis2Start = GLKVector3Subtract(GLKVector3Make(transformedCenter.x, transformedCenter.y, transformedCenter.z), GLKVector3Make(transformedAxis2.x, transformedAxis2.y, transformedAxis2.z));
        GLKVector3 axis2End = GLKVector3Add(GLKVector3Make(transformedCenter.x, transformedCenter.y, transformedCenter.z), GLKVector3Make(transformedAxis2.x, transformedAxis2.y, transformedAxis2.z));
        GLKVector3 axis3Start = GLKVector3Subtract(GLKVector3Make(transformedCenter.x, transformedCenter.y, transformedCenter.z), GLKVector3Make(transformedAxis3.x, transformedAxis3.y, transformedAxis3.z));
        GLKVector3 axis3End = GLKVector3Add(GLKVector3Make(transformedCenter.x, transformedCenter.y, transformedCenter.z), GLKVector3Make(transformedAxis3.x, transformedAxis3.y, transformedAxis3.z));
        
        // Collect the vertices
        GLfloat axesVertices[] = {
            axis1Start.x, axis1Start.y, 0.0f,
            axis1End.x, axis1End.y, 0.0f,
            
            axis2Start.x, axis2Start.y, 0.0f,
            axis2End.x, axis2End.y, 0.0f,
            
            axis3Start.x, axis3Start.y, 0.0f,
            axis3End.x, axis3End.y, 0.0f
        };
        
        GLKVector3 billboardCenter = GLKVector3Make(transformedCenter.x, transformedCenter.y, transformedCenter.z);
        
        // Calculate the vertices for the billboard's sides
        GLKVector3 billboardUp = GLKVector3Make(semimajor.x, semimajor.y, 0);
        GLKVector3 billboardRight = GLKVector3Make(semiminor.x, semiminor.y, 0);
        billboardUp = GLKVector3MultiplyScalar(billboardUp, 3.1);
        billboardRight = GLKVector3MultiplyScalar(billboardRight, 3.1);
        
        GLKVector3 billboardVertices[4];
        billboardVertices[0] = GLKVector3Subtract(GLKVector3Subtract(billboardCenter, billboardRight), billboardUp); // Bottom-left
        billboardVertices[1] = GLKVector3Add(GLKVector3Subtract(billboardCenter, billboardRight), billboardUp);     // Top-left
        billboardVertices[2] = GLKVector3Add(GLKVector3Add(billboardCenter, billboardRight), billboardUp);          // Top-right
        billboardVertices[3] = GLKVector3Subtract(GLKVector3Add(billboardCenter, billboardRight), billboardUp);     // Bottom-right
        
        // Set up vertex array and buffer for Gaussian axes
        [self drawLines:axesVertices n:6 e:3 mvp:GLKMatrix4Identity];
        
        // Compute the lengths of the projected axes
        float length1 = GLKVector2Length(GLKVector2Make(transformedAxis1.x, transformedAxis1.y));
        float length2 = GLKVector2Length(GLKVector2Make(transformedAxis2.x, transformedAxis2.y));
        float length3 = GLKVector2Length(GLKVector2Make(transformedAxis3.x, transformedAxis3.y));
        
        // Determine the semimajor and semiminor axes
        GLKVector2 semimajorAxis, semiminorAxis;
        if (length1 >= length2 && length1 >= length3) {
            semimajorAxis = GLKVector2Make(transformedAxis1.x, transformedAxis1.y);
            semiminorAxis = length2 >= length3 ? GLKVector2Make(transformedAxis2.x, transformedAxis2.y) : GLKVector2Make(transformedAxis3.x, transformedAxis3.y);
        } else if (length2 >= length1 && length2 >= length3) {
            semimajorAxis = GLKVector2Make(transformedAxis2.x, transformedAxis2.y);
            semiminorAxis = length1 >= length3 ? GLKVector2Make(transformedAxis1.x, transformedAxis1.y) : GLKVector2Make(transformedAxis3.x, transformedAxis3.y);
        } else {
            semimajorAxis = GLKVector2Make(transformedAxis3.x, transformedAxis3.y);
            semiminorAxis = length1 >= length2 ? GLKVector2Make(transformedAxis1.x, transformedAxis1.y) : GLKVector2Make(transformedAxis2.x, transformedAxis2.y);
        }
        
        // Calculate the angle between the semimajor and semiminor axes
        float angle = atan2f(semiminorAxis.y, semiminorAxis.x) - atan2f(semimajorAxis.y, semimajorAxis.x);
        
//        float sigmaMajor = length1;
//        float sigmaMinor = length2;
//        
//        float cosTheta = cosf(angle);
//        float sinTheta = sinf(angle);
        
        float covarianceMatrix[4] = {
            sigmaXX,
            sigmaXY,
            sigmaYX,
            sigmaYY
        };
        
        // Calculate the determinant
        float determinant = covarianceMatrix[0] * covarianceMatrix[3] - covarianceMatrix[1] * covarianceMatrix[2];
        
        // Compute the inverse of the covariance matrix
        float inverseCovarianceMatrix[4] = {
            covarianceMatrix[3] / determinant,
            -covarianceMatrix[1] / determinant,
            -covarianceMatrix[2] / determinant,
            covarianceMatrix[0] / determinant
        };
        
        // Set up the amplitude of the Gaussian (this controls the peak value at the center)
//        GLfloat amplitude = sqrtf([ellipsoid[@"determinant"] floatValue] / [decomposition2x2[@"determinant"] floatValue]); // You can adjust this value based on your needs
//        NSLog(@"amplitude: %f", amplitude);
        
        
//        GLuint amplitudeLocation = glGetUniformLocation(self.shaderProgram1, "u_amplitude");
//        glUniform1f(amplitudeLocation, amplitude);
        
        // Set up the color of the Gaussian (this controls the color of the splat)
        GLfloat color[3] = {0, 0, 0};
        if (index == 0) {
            color[0] = 1;
        } else {
            color[2] = 1;
        }
        
        // Pass the Gaussian mean to the shader
//        GLuint meanLocation = glGetUniformLocation(self.shaderProgram1, "u_center");
//        glUniform2f(meanLocation, billboardCenter.x, billboardCenter.y);
        
        // Pass the inverse covariance matrix to the shader
//        GLuint covInvLocation = glGetUniformLocation(self.shaderProgram1, "u_covInv");
//        glUniformMatrix2fv(covInvLocation, 1, GL_FALSE, inverseCovarianceMatrix);
        
        GLfloat billboardTriangleVertices[] = {
            // First triangle
            billboardVertices[0].x, billboardVertices[0].y, billboardVertices[0].z,
            billboardVertices[1].x, billboardVertices[1].y, billboardVertices[1].z,
            billboardVertices[2].x, billboardVertices[2].y, billboardVertices[2].z,
            
            // Second triangle
            billboardVertices[2].x, billboardVertices[2].y, billboardVertices[2].z,
            billboardVertices[3].x, billboardVertices[3].y, billboardVertices[3].z,
            billboardVertices[0].x, billboardVertices[0].y, billboardVertices[0].z,
        };
        
        [self drawTriangles:billboardTriangleVertices n:6 mvp:GLKMatrix4Identity amplitude:ratio color:color center:GLKVector2Make(billboardCenter.x, billboardCenter.y) covInv:inverseCovarianceMatrix];
    }
}

- (void)drawLines:(GLfloat[])vertexData n:(int)n e:(int)e mvp:(GLKMatrix4)mvp {
    glUseProgram(self.shaderProgram2);
    
    GLuint mvpMatrixLocation2 = glGetUniformLocation(self.shaderProgram2, "uModelViewProjectionMatrix");
    glUniformMatrix4fv(mvpMatrixLocation2, 1, GL_FALSE, mvp.m);
    
    // Set up vertex array and buffer
    GLuint axesVAO, axesVBO;
    glGenVertexArrays(1, &axesVAO);
    glGenBuffers(1, &axesVBO);
    
    glBindVertexArray(axesVAO);
    
    glBindBuffer(GL_ARRAY_BUFFER, axesVBO);
    size_t vertexDataSize = n * e * sizeof(GLfloat);
    glBufferData(GL_ARRAY_BUFFER, vertexDataSize, vertexData, GL_STATIC_DRAW);
    
    // Position attribute
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, e * sizeof(GLfloat), (GLvoid *)0);
    glEnableVertexAttribArray(0);
    
    // Color attribute
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, e * sizeof(GLfloat), (GLvoid *)(3 * sizeof(GLfloat)));
    glEnableVertexAttribArray(1);
    
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    
    // Draw the 3D crosshair
    glDrawArrays(GL_LINES, 0, n);
    
    // Cleanup
    glBindVertexArray(0);
    glDeleteVertexArrays(1, &axesVAO);
    glDeleteBuffers(1, &axesVBO);
}

- (void)drawTriangles:(GLfloat[])vertexData n:(int)n mvp:(GLKMatrix4)mvp amplitude:(float)amplitude color:(GLfloat[])color center:(GLKVector2)center covInv:(float[])covInv {
    glUseProgram(self.shaderProgram1);
    
    GLuint amplitudeLocation = glGetUniformLocation(self.shaderProgram1, "u_amplitude");
    glUniform1f(amplitudeLocation, amplitude);
    
    // Set up the color of the Gaussian (this controls the color of the splat)
    GLuint colorLocation = glGetUniformLocation(self.shaderProgram1, "u_color");
    glUniform3fv(colorLocation, 1, color);
    
    // Pass the Gaussian mean to the shader
    GLuint meanLocation = glGetUniformLocation(self.shaderProgram1, "u_center");
    glUniform2f(meanLocation, center.x, center.y);
    
    // Pass the inverse covariance matrix to the shader
    GLuint covInvLocation = glGetUniformLocation(self.shaderProgram1, "u_covInv");
    glUniformMatrix2fv(covInvLocation, 1, GL_FALSE, covInv);
    
    GLuint mvpMatrixLocation2 = glGetUniformLocation(self.shaderProgram1, "uModelViewProjectionMatrix");
    glUniformMatrix4fv(mvpMatrixLocation2, 1, GL_FALSE, mvp.m);
    
//    GLuint billboardVAO, billboardVBO;
//    glGenVertexArrays(1, &billboardVAO);
//    glGenBuffers(1, &billboardVBO);
//    
//    glBindVertexArray(billboardVAO);
//    
//    glBindBuffer(GL_ARRAY_BUFFER, billboardVBO);
//    glBufferData(GL_ARRAY_BUFFER, sizeof(billboardTriangleVertices), billboardTriangleVertices, GL_STATIC_DRAW);
//    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(GLfloat), (GLvoid *)0);
//    glEnableVertexAttribArray(0);
//    
//    glBindBuffer(GL_ARRAY_BUFFER, 0);
//    
//    // Draw the billboard edges
//    //        glDrawArrays(GL_LINES, 0, 8);
//    glDrawArrays(GL_TRIANGLES, 0, 6);
//    
//    // Cleanup
//    glBindVertexArray(0);
//    glDeleteVertexArrays(1, &axesVAO);
//    glDeleteBuffers(1, &axesVBO);
//    glDeleteVertexArrays(1, &billboardVAO);
//    glDeleteBuffers(1, &billboardVBO);
    
    // Set up vertex array and buffer
    GLuint axesVAO, axesVBO;
    glGenVertexArrays(1, &axesVAO);
    glGenBuffers(1, &axesVBO);
    
    glBindVertexArray(axesVAO);
    
    glBindBuffer(GL_ARRAY_BUFFER, axesVBO);
    size_t vertexDataSize = n * 3 * sizeof(GLfloat);
    glBufferData(GL_ARRAY_BUFFER, vertexDataSize, vertexData, GL_STATIC_DRAW);
    
    // Position attribute
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(GLfloat), (GLvoid *)0);
    glEnableVertexAttribArray(0);
    
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    
    // Draw the 3D crosshair
    glDrawArrays(GL_TRIANGLES, 0, n);
    
    // Cleanup
    glBindVertexArray(0);
    glDeleteVertexArrays(1, &axesVAO);
    glDeleteBuffers(1, &axesVBO);
}

- (void)checkShaderCompilation:(GLuint)shader {
    GLint success;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
    if (!success) {
        GLchar infoLog[512];
        glGetShaderInfoLog(shader, 512, NULL, infoLog);
        NSLog(@"ERROR::SHADER::COMPILATION_FAILED\n%s", infoLog);
    }
}

- (void)checkProgramLinking:(GLuint)program {
    GLint success;
    glGetProgramiv(program, GL_LINK_STATUS, &success);
    if (!success) {
        GLchar infoLog[512];
        glGetProgramInfoLog(program, 512, NULL, infoLog);
        NSLog(@"ERROR::PROGRAM::LINKING_FAILED\n%s", infoLog);
    }
}

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    UITouch *touch = [touches anyObject];
    self.lastTouchLocation = [touch locationInView:self];
    self.isTouchActive = YES; // Disable PID loops
    self.isPIDRunning = NO;   // Stop the PID loop
    
    // Reset all variables
    self.rotationPitchVelocity = 0.0f;
    self.rotationYawVelocity = 0.0f;
    self.rotationRollVelocity = 0.0f;
    [self resetPIDVariables];
    self.previousTime = CACurrentMediaTime(); // Reset time tracking
}

- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    UITouch *touch = [touches anyObject];
    CGPoint currentTouchLocation = [touch locationInView:self];

    // Calculate the rotation based on the difference between the last and current touch location
    CGFloat dx = currentTouchLocation.x - self.lastTouchLocation.x;
    CGFloat dy = currentTouchLocation.y - self.lastTouchLocation.y;

    // Swap the roles of X and Y for the rotation
    float angleX = GLKMathDegreesToRadians(dx / 2.0f);
    float angleY = GLKMathDegreesToRadians(dy / 2.0f);
    
    // Convert touch deltas to rotation velocities
    self.rotationPitchVelocity = angleY; // Y axis movement affects X rotation
    self.rotationYawVelocity = angleX;   // X axis movement affects Y rotation
    self.rotationRollVelocity = 0.0f; // Assuming no roll control with touch

    // Create the rotation matrices for the Y and X axes
    GLKMatrix4 rotationX = GLKMatrix4MakeRotation(self.rotationPitchVelocity, 1.0f, 0.0f, 0.0f);
    GLKMatrix4 rotationY = GLKMatrix4MakeRotation(self.rotationYawVelocity, 0.0f, 1.0f, 0.0f);
    GLKMatrix4 rotationZ = GLKMatrix4MakeRotation(self.rotationRollVelocity, 0.0f, 0.0f, 1.0f);
//    GLKMatrix4 rotationX = GLKMatrix4MakeRotation(angleY, 1.0f, 0.0f, 0.0f); // Y axis movement affects X rotation
//    GLKMatrix4 rotationY = GLKMatrix4MakeRotation(angleX, 0.0f, 1.0f, 0.0f); // X axis movement affects Y rotation

    // To maintain Y-up, apply the rotationY first, followed by rotationX
    self.rotationMatrix = GLKMatrix4Multiply(GLKMatrix4Multiply(rotationX, self.rotationMatrix), rotationY);

    // Update the last touch location
    self.lastTouchLocation = currentTouchLocation;

    // Request a redraw
    [self setNeedsDisplay];
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    self.lastTouchLocation = CGPointZero;
    [self resetPIDVariables];
    self.isPIDRunning = YES;
    self.previousTime = CACurrentMediaTime(); // Reset time tracking
    self.isTouchActive = NO;
}

- (void)updateRotationMatrix {
    NSLog(@"updateRotationMatrix");
    
    CFTimeInterval currentTime = CACurrentMediaTime();
    float deltaTime = (float)(currentTime - self.previousTime);
    self.previousTime = currentTime;
    
    if (deltaTime < 0.5f / 60.0f) {
        return;
    }

    if (self.isTouchActive) {
        float currentPitch, currentYaw, currentRoll;
        GLKVector3 rotationAngles = [self extractEulerAnglesFromMatrix:self.rotationMatrix];
        currentPitch = rotationAngles.x;
        currentYaw = rotationAngles.y;
        currentRoll = rotationAngles.z;
//        NSLog(@"currentPitch %f", currentPitch);
//        NSLog(@"currentYaw %f", currentYaw);
        return;
    }
    
    if (self.isPIDRunning) {
        // Assuming you have target rotation angles (e.g., desiredPitch, desiredYaw, desiredRoll) you want to maintain
        float desiredPitch = 0;
        float desiredYaw = 0;
        float desiredRoll = 0.0f;

        // Extract current Euler angles from the rotation matrix
        float currentPitch, currentYaw, currentRoll;
        GLKVector3 rotationAngles = [self extractEulerAnglesFromMatrix:self.rotationMatrix];
        currentPitch = rotationAngles.x;
        currentYaw = rotationAngles.y;
        currentRoll = rotationAngles.z;

        // Calculate the error in rotational position
        float pitchError = -(desiredPitch - currentPitch);
        float yawError = -(desiredYaw - currentYaw);
        float rollError = desiredRoll - currentRoll;
        
        NSLog(@"currentPitch %f", currentPitch);
        NSLog(@"currentYaw %f", currentYaw);
//        NSLog(@"pitchError %f", pitchError);
//        NSLog(@"yawError %f", yawError);
//        NSLog(@"previousPitchError %f", _previousPitchError);
//        NSLog(@"_pitchIntegral %f", _pitchIntegral);
//        NSLog(@"_pitchDerivative %f", _pitchDerivative);
        NSLog(@"deltaTime %f", deltaTime);
        

        // Use the PID controller to calculate the adjustments needed
        float pitchAdjustment = [self calculatePIDForAxisWithKp:self.kpPitch Ki:self.kiPitch Kd:self.kdPitch integral:&_pitchIntegral derivative:&_pitchDerivative previousError:&_previousPitchError error:pitchError deltaTime:deltaTime];
        float yawAdjustment = [self calculatePIDForAxisWithKp:self.kpYaw Ki:self.kiYaw Kd:self.kdYaw integral:&_yawIntegral derivative:&_yawDerivative previousError:&_previousYawError error:yawError deltaTime:deltaTime];
//        float rollAdjustment = [self calculatePIDForAxisWithKp:self.kpRoll Ki:self.kiRoll Kd:self.kdRoll integral:&_rollIntegral derivative:&_rollDerivative previousError:&_previousRollError error:rollError deltaTime:deltaTime];
        
        
//        NSLog(@"pitchAdjustment %f", pitchAdjustment);
        
        // Apply the PID adjustments to the rotation matrix
        GLKMatrix4 rotationX = GLKMatrix4MakeRotation(pitchAdjustment, 1.0f, 0.0f, 0.0f);
        GLKMatrix4 rotationY = GLKMatrix4MakeRotation(yawAdjustment, 0.0f, 1.0f, 0.0f);
//        GLKMatrix4 rotationZ = GLKMatrix4MakeRotation(rollAdjustment, 0.0f, 0.0f, 1.0f);
        self.rotationMatrix = GLKMatrix4Multiply(GLKMatrix4Multiply(rotationX, self.rotationMatrix), rotationY);
    }

    // Apply the rotation velocities to the rotation matrix
    GLKMatrix4 rotationX = GLKMatrix4MakeRotation(self.rotationPitchVelocity, 1.0f, 0.0f, 0.0f);
    GLKMatrix4 rotationY = GLKMatrix4MakeRotation(self.rotationYawVelocity, 0.0f, 1.0f, 0.0f);
    GLKMatrix4 rotationZ = GLKMatrix4MakeRotation(self.rotationRollVelocity, 0.0f, 0.0f, 1.0f);
    self.rotationMatrix = GLKMatrix4Multiply(GLKMatrix4Multiply(rotationX, self.rotationMatrix), rotationY);
    
    // Decay the rotation velocities
    self.rotationPitchVelocity *= 0.95f;
    self.rotationYawVelocity *= 0.95f;
    self.rotationRollVelocity *= 0.95f;
}

- (GLKVector3)extractEulerAnglesFromMatrix:(GLKMatrix4)matrix {
    float pitch, yaw, roll;

    // Calculate yaw (rotation around Y-axis)
    yaw = atan2f(matrix.m02, matrix.m22);

    // Calculate pitch (rotation around X-axis)
    pitch = atan2f(-matrix.m12, sqrtf(matrix.m02 * matrix.m02 + matrix.m22 * matrix.m22));

    // Calculate roll (rotation around Z-axis)
    roll = atan2f(matrix.m10, matrix.m11);

    // Return the Euler angles
    return GLKVector3Make(pitch, yaw, roll);
}

- (float)calculatePIDForAxisWithKp:(float)kp Ki:(float)ki Kd:(float)kd integral:(float *)integral derivative:(float *)derivative previousError:(float *)previousError error:(float)error deltaTime:(float)deltaTime {;
    *integral += error * deltaTime;
    *derivative = (error - *previousError) / deltaTime;
//    NSLog(@"kp %f", kp);
//    NSLog(@"error %f", error);
//    NSLog(@"ki %f", ki);
//    NSLog(@"integral %f", *integral);
//    NSLog(@"kd %f", kd);
//    NSLog(@"derivative %f", *derivative);
    float output = kp * error + ki * (*integral) + kd * (*derivative);
    *previousError = error;
    return output;
}

- (void)cleanup {
    if (!self.isCleaned) {
        self.isCleaned = YES;
        
        ClusteringAndEllipsoids *clustering = [[ClusteringAndEllipsoids alloc] init];
        [clustering freeClusteringData:self.clusteringResults];

        if (_vertexArray) {
            glDeleteVertexArrays(1, &_vertexArray);
        }
        if (_vertexBuffer) {
            glDeleteBuffers(1, &_vertexBuffer);
        }
        if (self.shaderProgram1) {
            glDeleteProgram(self.shaderProgram1);
        }
        if (self.shaderProgram2) {
            glDeleteProgram(self.shaderProgram2);
        }
        
        [self.displayLink invalidate];
        self.displayLink = nil;
        
        self.isPIDRunning = NO; // Stop the PID loop
        self.rotationPitchVelocity = 0.0f;
        self.rotationYawVelocity = 0.0f;
        self.rotationRollVelocity = 0.0f;
        [self resetPIDVariables];
        self.previousTime = CACurrentMediaTime(); // Reset time tracking
    }
}

- (void)dealloc {
    [self cleanup];
}

- (void)removeFromSuperview {
    [self cleanup];
    [super removeFromSuperview];
}

@end
