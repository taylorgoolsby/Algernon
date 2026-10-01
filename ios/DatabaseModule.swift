import Foundation
import GRDB

@objc(DatabaseModule)
class DatabaseModule: NSObject {
    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc func initialize(_ resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        DatabaseManager.shared.initialize()
        resolve("Database initialized")
    }

    @objc func executeQuery(_ query: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        print("query: \(query)")
        let (isSuccessful, results, lastInsertRowID, errorMessage) = DatabaseManager.shared.executeQuery(query)
        print("results: \(results)")
        
        if isSuccessful {
            var response: [String: Any] = ["results": results]
            if let insertID = lastInsertRowID {
                response["insertId"] = insertID
            }
            resolve(response)
        } else {
            reject("SQL_ERROR", errorMessage ?? "Failed to execute query", nil)
        }
    }

    @objc func format(_ query: String, arguments: [Any], resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let statementArguments = StatementArguments(arguments) else {
                reject("FORMAT_ERROR", "Invalid statement arguments", nil)
                return
            }
            let formattedQuery = try formatQuery(query: query, arguments: statementArguments)
            resolve(formattedQuery)
        } catch {
            reject("FORMAT_ERROR", "Failed to format query", error)
        }
    }

    private func formatQuery(query: String, arguments: StatementArguments) throws -> String {
        print("query: \(query)")
        print("arguments: \(arguments)")
        guard let dbQueue = DatabaseManager.shared.dbQueue else {
            throw NSError(domain: "DatabaseModule", code: 1, userInfo: [NSLocalizedDescriptionKey: "Database queue not initialized"])
        }
        let formattedQuery: String = try dbQueue.read { db in
            let statement = try db.makeStatement(sql: query)
            statement.arguments = arguments
            print("statement.sql: \(statement.sql)")
            return statement.sql
        }
        print("formattedQuery: \(formattedQuery)")
        return formattedQuery
    }
  
    @objc func fetchAnnotations(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        let query = "SELECT * FROM Annotation ORDER BY annotationId ASC;"
        let (isSuccessful, results, _, errorMessage) = DatabaseManager.shared.executeQuery(query)
        
        if isSuccessful {
            resolve(results)
        } else {
            reject("SQL_ERROR", errorMessage ?? "Failed to fetch annotations", nil)
        }
    }
}
