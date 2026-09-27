// @flow

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { compiler } from 'markdown-to-jsx';
import Text from './Text';
import Colors from './Colors';

const Bullet = (props: any) => {
  return (
    <Text
      selectable
      style={[
        props.style,
        {
          top: -2,
          marginRight: Colors.fontSize / 2,
          marginLeft: Colors.fontSize / 2,
          fontFamily: 'Verdana',
        },
      ]}
    >
      {'• '}
    </Text>
  );
};

const Wrapper = (props: any) => {};

const H1 = () => {};

const H2 = () => {};

const H3 = () => {};

const P = () => {};

const UL = () => {};

const OL = () => {};

const LI = () => {};

const Strong = () => {};

const A = () => {};

const Code = () => {};

const MarkdownText = (props: any): any => {
  const textStyle = Array.isArray(props.textStyle)
    ? props.textStyle
    : [props.textStyle];
  const { style, children, onLayout } = props;

  const [compiledChildren, setCompiledChildren] = useState<Array<any>>([]);

  useEffect(() => {
    const compiled = compiler(children, {
      forceWrapper: true,
      // @ts-ignore
      wrapper: Wrapper,
      createElement(type, props, children) {
        if (type === 'h1') {
          // @ts-ignore
          return <H1 {...props} children={children} />;
        }

        if (type === 'h2') {
          // @ts-ignore
          return <H2 {...props} children={children} />;
        }

        if (type === 'h3') {
          // @ts-ignore
          return <H3 {...props} children={children} />;
        }

        if (type === 'p') {
          // @ts-ignore
          return <P {...props} children={children} />;
        }

        if (type === 'ul') {
          return (
            // @ts-ignore
            <UL {...props}>
              {
                // @ts-ignore
                children.map((child, index) => (
                  // @ts-ignore
                  <LI key={index} children={child.props.children} />
                ))
              }
            </UL>
          );
        }

        if (type === 'ol') {
          return (
            // @ts-ignore
            <OL {...props}>
              {
                // @ts-ignore
                children.map((child, index) => (
                  // @ts-ignore
                  <LI key={index} children={child.props.children} />
                ))
              }
            </OL>
          );
        }

        if (type === 'li') {
          // @ts-ignore
          return <LI {...props} children={children} />;
        }

        if (type === 'strong') {
          // @ts-ignore
          return <Strong {...props} children={children} />;
        }

        if (type === 'a') {
          // @ts-ignore
          return <A {...props} children={children} />;
        }

        if (type === 'code') {
          return (
            // @ts-ignore
            <Code
              {...props}
              // @ts-ignore
              children={Array.isArray(children) ? children : [children]}
            />
          );
        }
        // @ts-ignore
        if (children?.type === Code) {
          // @ts-ignore
          return <Code {...props} children={children.props.children} />;
        }

        return <Text {...props} children={children} />;
      },
    });
    // console.log("compiled", compiled);
    // console.log("compiled.children", compiled.props.children);
    // @ts-ignore
    if (Array.isArray(compiled.props.children)) {
      // @ts-ignore
      setCompiledChildren(compiled.props.children);
      // @ts-ignore
    } else if (typeof compiled.props.children === 'string') {
      // @ts-ignore
      setCompiledChildren([compiled.props.children]);
    } else {
      console.warn('unknown markdown case');
      setCompiledChildren([]);
    }
  }, [children]);

  function getMargins(
    children: Array<any>,
    parentType: any,
    // @ts-ignore
  ): Array<{ [string]: number }> {
    return children.map((child, index) => {
      const isFirst = index === 0;
      const isLast = index === compiledChildren.length - 1;

      // @ts-ignore
      let result: { [string]: number } = {};

      if (child.type === P || child.type === UL || child.type === OL) {
        result = {
          // @ts-ignore
          marginTop: isFirst ? 0 : (Colors.fontSize * 1.5) / 2,
          marginBottom: isLast ? 0 : (Colors.fontSize * 1.5) / 2,
        };
      }

      const prevType = compiledChildren[index - 1]?.type;
      if (prevType === P || prevType === UL || prevType === OL) {
        // @ts-ignore
        result.marginTop = 0;
      }

      // if ((child.type === P || child.type === UL || child.type === OL) && parentType === LI) {
      //   result.marginBottom = 0
      // }

      return result;
    });
  }

  if (!compiledChildren.length) {
    return <View style={style} onLayout={onLayout} />;
  }

  function renderChildren(
    children: Array<any>,
    parentDisplayType: any,
    parentActualType: any,
  ): Array<any> {
    const margins = getMargins(children, parentActualType);

    return children.map((child, index) => {
      if (typeof child === 'string') {
        if (parentDisplayType === Text && parentActualType !== Code) {
          return child;
        } else {
          return (
            <Text
              key={index}
              selectable
              style={[
                textStyle,
                margins[index],
                parentActualType === Code
                  ? {
                      fontFamily: 'DM Mono',
                      fontSize: 14,
                      fontWeight: '400',
                      letterSpacing: 0.0,
                    }
                  : {},
              ]}
            >
              {child}
            </Text>
          );
        }
      }

      if (child.type === H1) {
        return (
          <Text
            key={index}
            selectable
            style={[
              textStyle,
              {
                ...margins[index],
                fontSize: Colors.fontSize * 2,
                lineHeight: Colors.fontSize * 2 * 1.5,
                fontWeight: '700',
              },
            ]}
          >
            {renderChildren(child.props.children, Text, child.type)}
          </Text>
        );
      }

      if (child.type === H2) {
        return (
          <Text
            key={index}
            selectable
            style={[
              textStyle,
              {
                ...margins[index],
                fontSize: Colors.fontSize * 1.5,
                lineHeight: Colors.fontSize * 1.5 * 1.5,
                fontWeight: '700',
              },
            ]}
          >
            {renderChildren(child.props.children, Text, child.type)}
          </Text>
        );
      }

      if (child.type === H3) {
        return (
          <Text
            key={index}
            selectable
            style={[
              textStyle,
              {
                ...margins[index],
                fontSize: Colors.fontSize * 1.25,
                lineHeight: Colors.fontSize * 1.25 * 1.5,
                fontWeight: '600',
              },
            ]}
          >
            {renderChildren(child.props.children, Text, child.type)}
          </Text>
        );
      }

      if (child.type === P) {
        if (parentDisplayType === Text) {
          // a View cannot be placed inside of a Text
          return (
            <Text
              key={index}
              selectable
              style={[
                textStyle,
                {
                  ...margins[index], // Text inside of Text does not support margin.
                },
              ]}
            >
              {renderChildren(child.props.children, Text, child.type)}
            </Text>
          );
        } else {
          return (
            <Text
              key={index}
              selectable
              style={[
                textStyle,
                {
                  ...margins[index],
                },
              ]}
            >
              {renderChildren(child.props.children, Text, child.type)}
            </Text>
          );
        }
      }

      if (child.type === UL || child.type === OL) {
        return (
          <View
            key={index}
            style={[
              textStyle,
              {
                ...margins[index],
              },
            ]}
          >
            {renderChildren(child.props.children, View, child.type)}
          </View>
        );
      }

      if (child.type === LI) {
        return (
          <View key={index} style={{ ...margins[index], flexDirection: 'row' }}>
            {parentActualType === OL ? (
              <Text
                selectable
                style={[textStyle, { top: -1, minWidth: 19 }]}
              >{`${index + 1}. `}</Text>
            ) : (
              <Bullet style={textStyle} />
            )}
            <View style={{ flex: 1 }}>
              {renderChildren(child.props.children, View, child.type)}
            </View>
          </View>
        );
      }

      if (child.type === Strong) {
        return (
          <Text
            key={index}
            selectable
            style={[textStyle, { ...margins[index], fontWeight: '500' }]}
          >
            {renderChildren(child.props.children, Text, child.type)}
          </Text>
        );
      }

      if (child.type === A) {
        return (
          <Text
            key={index}
            selectable
            style={[textStyle, { ...margins[index], color: Colors.blue }]}
          >
            {renderChildren(child.props.children, Text, child.type)}
          </Text>
        );
      }

      if (child.type === Code) {
        if (parentDisplayType === Text) {
          return (
            <Text
              key={index}
              selectable
              style={[textStyle, { ...margins[index] }]}
            >
              {renderChildren(child.props.children, Text, child.type)}
            </Text>
          );
        } else {
          return (
            <View key={index} style={[textStyle, { ...margins[index] }]}>
              {renderChildren(child.props.children, View, child.type)}
            </View>
          );
        }
      }
    });
  }

  return (
    <View style={style} onLayout={onLayout}>
      {
        // @ts-ignore
        renderChildren(compiledChildren)
      }
    </View>
  );
};

const styles = StyleSheet.create({});

export default MarkdownText;
