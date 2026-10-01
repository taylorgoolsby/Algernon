// @flow

import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Ionicons } from '@react-native-vector-icons/ionicons/static'
import Colors from "../Colors";
import { BlurView } from "@react-native-community/blur";
import { MessageRole, MessageSQL } from "../schema/Message/MessageSchema";

type ProfilePicProps = {
  message: MessageSQL,
  noBorder?: boolean,
  isActive?: boolean,
  tenX?: boolean,
}

type Orb = {
  xPos: number,
  yPos: number,
  xVel: number,
  yVel: number,
  color: string,
}

type OrbSim = {
  time: number,
  points: Array<Orb>
}

const orbSims: {[messageId: string]: OrbSim} = {}

const getOrCreateOrbSim = (messageId: number, scale: number): OrbSim => {
    if (!orbSims[messageId.toString()]) {
      const r = 7 * scale
      const v = 5 * scale
      const m = Math.random()
      const phase = Math.random() * 2 * Math.PI

      orbSims[messageId.toString()] = {
        time: Date.now(),
        points: [
          {
            xPos: 0,
            yPos: 0,
            xVel: 0,
            yVel: 0,
            color: Colors.blue
          },
          {
            xPos: r * Math.sin(Math.PI),
            yPos: r * Math.cos(Math.PI),
            xVel: v * Math.cos(Math.PI + phase),
            yVel: -v * Math.sin(Math.PI + phase),
            color: 'rgba(255, 186, 0, 0.9)'
          },
          {
            xPos: 0.5 * r * Math.sin(m * 2 * Math.PI),
            yPos: 0.5 * r * Math.cos(m * 2 * Math.PI),
            xVel: (Math.random() - 0.5) * 2 * v,
            yVel: (Math.random() - 0.5) * 2 * v,
            color: 'rgb(215, 29, 29)'
          },
          {
            xPos: r * Math.sin(2 * Math.PI),
            yPos: r * Math.cos(2 * Math.PI),
            xVel: v * Math.cos(2 * Math.PI + phase),
            yVel: -v * Math.sin(2 * Math.PI + phase),
            color: Colors.teal
          },
          {
            xPos: 0,
            yPos: 0,
            xVel: 0,
            yVel: 0,
            color: Colors.blue
          },
        ]}
    }
    return orbSims[messageId.toString()]
  }

const updateOrbSim = (messageId: number, time: number, scale: number) => {
    const sim = getOrCreateOrbSim(messageId, scale)

    // Implement a simple spring force simulation on the dots:
    // 1. Calculate the force on each dot
    // 2. Update the velocity of each dot
    // 3. Update the position of each dot
    // 4. Repeat
    const k = 0.1
    const dt = (Math.min(time - sim.time, 1000) * 0.001) / 2
    // const dt = 0
    sim.time = time
    const n = sim.points.length

    for (let i = 0; i < n; i++) {
      if (i === 0) {
        // first point is fixed.
        continue
      }
      for (let j = 0; j < n; j++) {
        if (i === j) {
          continue
        }
        const dx = sim.points[j].xPos - sim.points[i].xPos
        const dy = sim.points[j].yPos - sim.points[i].yPos
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < 0.005) {
          continue
        }
        const f = k * d
        const fx = (f * dx) / d
        const fy = (f * dy) / d
        sim.points[i].xVel += fx * dt
        sim.points[i].yVel += fy * dt
        sim.points[i].xPos += sim.points[i].xVel * dt
        sim.points[i].yPos += sim.points[i].yVel * dt

        if (isNaN(sim.points[i].xVel)) {
          sim.points[i].xVel = 0
        }
        if (isNaN(sim.points[i].yVel)) {
          sim.points[i].yVel = 0
        }
        if (isNaN(sim.points[i].xPos)) {
          sim.points[i].xPos = 0
        }
        if (isNaN(sim.points[i].yPos)) {
          sim.points[i].yPos = 0
        }
      }
    }
  }

const ProfilePic = (props: ProfilePicProps): any => {
  const {
    message,
    noBorder,
    isActive,
    tenX,
  } = props

  const t = tenX ? 10 : 1

  const [time, setTime] = useState(Date.now())

  const step = () => {
    const nextTime = Date.now()
    setTime(nextTime)
    updateOrbSim(message.messageId, nextTime, t)
  }

  const timeout = useRef<any>(null)
  useEffect(() => {
    if (message.role === MessageRole.ASSISTANT) {
      // A step must render first before queueing another step.
      // So setTimeout is called in a render, not at the end of the step function.
      // This prevents the event queue from being filled with step calls,
      // which blocks touch events as they are added to the end of a long queue.
      if (timeout.current) {
        clearTimeout(timeout.current)
        timeout.current = null
      }
      timeout.current = setTimeout(() => {
        timeout.current = null
        step()
      }, 17)
    }
  }, [time, message.role, message.messageId])

  const points = orbSims[message.messageId.toString()]?.points ?? []

  let averageDistanceFromCenter = Math.sqrt(points.reduce((acc, orb, i) => {
    return acc + orb.xPos * orb.xPos + orb.yPos * orb.yPos
  }, 0) / 4)

  const overlay = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 24 * t,
    height: 24 * t,
  }

  if (message.role === MessageRole.USER) {
    // return (
    //   <Image
    //     style={{
    //       width: 28,
    //       height: 28,
    //       borderRadius: 14,
    //       borderWidth: 1,
    //       borderColor:
    //         message.role === MessageRole.USER
    //           ? // ? 'rgba(255, 186, 0, 0.9)'
    //             'white'
    //           : 'rgba(62, 56, 225, 0.7)',
    //     }}
    //     source={
    //       message.role === MessageRole.USER
    //         ? {uri: 'AppIcon'}
    //         : {uri: 'LogoTransparent'}
    //     }
    //   />
    // )

    return (
      <View
        style={{
          width: 24 * t,
          height: 24 * t,
          borderRadius: 12 * t,
          overflow: 'hidden',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          marginRight: 8
        }}>
        <Ionicons
          style={[
            // @ts-ignore
            overlay,
            {
              width: 20,
              height: 20,
              marginTop: 6,
              marginLeft: 2,
            },
          ]}
          name={'person'}
          size={20}
          color={'rgba(0, 0, 0, 0.7)'}
        />

        <View
          style={[
            // @ts-ignore
            overlay,
            {
              width: 24 * t,
              height: 24 * t,
              borderRadius: 12 * t,
              // borderWidth: noBorder ? 0 : 1,
              borderWidth: noBorder ? 0 : 1,
              borderColor: 'rgba(0, 0, 0, 0.65)',
            },
          ]}
        />
      </View>
    )
  } else {
    const g = 2.8 / 10

    return (
      <View
        style={{
          width: 24 * t,
          height: 24 * t,
          borderRadius: 12 * t,
          overflow: 'hidden',
          // backgroundColor: darkMode ? 'black' : 'white',
          backgroundColor: 'white',
          marginRight: 8
        }}>
        {points.map((orb, i) => {
          return (
            <View
              key={i}
              style={[
                // @ts-ignore
                overlay,
                i === 0
                  ? {
                      borderRadius: (8 * t + averageDistanceFromCenter / g) / 2,
                      width: 8 * t + averageDistanceFromCenter / g,
                      height: 8 * t + averageDistanceFromCenter / g,
                      top: '50%',
                      left: '50%',
                      marginLeft:
                        -((8 * t + averageDistanceFromCenter / g) / 2) + orb.xPos,
                      marginTop:
                        -((8 * t + averageDistanceFromCenter / g) / 2) + -orb.yPos,
                      backgroundColor: orb.color,
                    }
                  : {
                      borderRadius: 5 * t,
                      width: 10 * t,
                      height: 10 * t,
                      top: '50%',
                      left: '50%',
                      marginLeft: -5 * t + orb.xPos,
                      marginTop: -5 * t + -orb.yPos,
                      backgroundColor: orb.color
                    },
              ]}
            />
          )
        })}

        <BlurView
          style={[
            // @ts-ignore
            overlay,
            {
              width: 24 * t,
              height: 24 * t,
              borderRadius: 12 * t,
              // borderWidth: noBorder ? 0 : 1,
              borderWidth: noBorder ? 0 : 1,
              borderColor: Colors.blue,
            },
          ]}
          blurAmount={5 * t}
          blurType="light"
        />
      </View>
    )
  }
}

export default ProfilePic
