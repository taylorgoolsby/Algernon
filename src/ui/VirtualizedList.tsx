// src/ui/VirtualizedList.tsx
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native'

/**
 * A minimal virtualized list built on ScrollView.
 *
 * - Items have variable heights. Unmeasured items use `estimatedItemHeight`;
 *   real heights are recorded through onLayout and replace the estimates.
 * - Only the items intersecting the viewport (plus `overscanPx` on each side)
 *   are mounted. Everything else is represented by two spacer Views.
 * - On first mount (or when data first becomes non-empty) the list is
 *   positioned at the bottom before it is shown. It is hidden (opacity 0)
 *   for the one or two frames it takes to render the tail items and scroll
 *   to the end, so the user never sees a jump from the top.
 */

export type VirtualizedListHandle = {
  scrollToEnd: (opts?: { animated?: boolean }) => void
  scrollToOffset: (opts: { offset: number; animated?: boolean }) => void
}

type Props<T> = {
  data: ReadonlyArray<T>
  renderItem: (info: { item: T; index: number }) => React.ReactElement | null
  keyExtractor: (item: T, index: number) => string
  /** Changing this re-renders the mounted items (like FlatList's extraData). */
  extraData?: unknown
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  estimatedItemHeight?: number
  /** How far beyond the viewport (in px) items stay mounted. */
  overscanPx?: number
}

const DEFAULT_ESTIMATE = 120
const DEFAULT_OVERSCAN = 800
// Within this many px of the end, the list counts as "at the bottom".
const AT_BOTTOM_THRESHOLD = 60

// Index of the first item whose bottom edge is below `y`.
function findFirstIndexBelow(offsets: number[], count: number, y: number) {
  let lo = 0
  let hi = count - 1
  let ans = count - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid + 1] > y) {
      ans = mid
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }
  return ans
}

function VirtualizedListInner<T>(
  {
    data,
    renderItem,
    keyExtractor,
    extraData,
    style,
    contentContainerStyle,
    estimatedItemHeight = DEFAULT_ESTIMATE,
    overscanPx = DEFAULT_OVERSCAN,
  }: Props<T>,
  ref: React.ForwardedRef<VirtualizedListHandle>,
) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null)

  // key -> measured height. Lives in a ref; `heightsVersion` triggers renders.
  const heights = useRef(new Map<string, number>()).current
  const [heightsVersion, setHeightsVersion] = useState(0)
  const pendingBump = useRef(false)

  const [viewportHeight, setViewportHeight] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const scrollYRef = useRef(0)

  // Bottom anchoring state.
  // `anchoring`: we are still forcing the list to the bottom (initial mount).
  // `ready`: the list has been positioned and is shown.
  const anchoring = useRef(true)
  const [ready, setReady] = useState(false)
  const hasData = data.length > 0

  // Stick-to-bottom state.
  // `isAtBottom`: while true, any content growth keeps the list pinned to the end.
  // `forcePin`: set by an explicit scrollToEnd() so the intermediate positions
  // of that scroll don't clear `isAtBottom`. Cleared when the user drags.
  const isAtBottom = useRef(true)
  const forcePin = useRef(false)

  const flat = StyleSheet.flatten(contentContainerStyle) || {}
  const padTop = Number(flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 0)
  const padBottom = Number(
    flat.paddingBottom ?? flat.paddingVertical ?? flat.padding ?? 0,
  )

  const keys = useMemo(
    () => data.map((item, i) => keyExtractor(item, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  )

  // offsets[i] = top of item i (relative to the first item); offsets[n] = total.
  const offsets = useMemo(() => {
    const out = new Array<number>(keys.length + 1)
    out[0] = 0
    for (let i = 0; i < keys.length; i++) {
      out[i + 1] = out[i] + (heights.get(keys[i]) ?? estimatedItemHeight)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, heightsVersion, estimatedItemHeight])

  const count = keys.length
  const totalHeight = offsets[count]

  // Compute the window [first, last].
  let first = 0
  let last = -1
  if (count > 0 && viewportHeight > 0) {
    if (anchoring.current) {
      // Render the tail so the bottom is real, measured content.
      const target = Math.max(0, totalHeight - viewportHeight - overscanPx)
      first = findFirstIndexBelow(offsets, count, target)
      last = count - 1
    } else {
      const top = Math.max(0, scrollY - padTop - overscanPx)
      const bottom = scrollY - padTop + viewportHeight + overscanPx
      first = findFirstIndexBelow(offsets, count, top)
      last = findFirstIndexBelow(offsets, count, bottom)
    }
  }

  const topSpacer = last >= 0 ? offsets[first] : 0
  const bottomSpacer = last >= 0 ? totalHeight - offsets[last + 1] : 0

  const bumpHeights = useCallback(() => {
    if (pendingBump.current) return
    pendingBump.current = true
    // Batch all onLayout callbacks from one commit into a single render.
    requestAnimationFrame(() => {
      pendingBump.current = false
      setHeightsVersion(v => v + 1)
    })
  }, [])

  const onItemLayout = useCallback(
    (key: string, e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height
      if (heights.get(key) !== h) {
        heights.set(key, h)
        bumpHeights()
      }
    },
    [heights, bumpHeights],
  )

  const scrollToEnd = useCallback((opts?: { animated?: boolean }) => {
    isAtBottom.current = true
    forcePin.current = true
    scrollRef.current?.scrollToEnd({ animated: opts?.animated ?? true })
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd,
      scrollToOffset: ({ offset, animated = true }) =>
        scrollRef.current?.scrollTo({ y: offset, animated }),
    }),
    [scrollToEnd],
  )

  // Ends the anchoring phase and shows the list. Waits (a few frames) until
  // pending height measurements have been applied so we reveal a settled list.
  const revealTries = useRef(0)
  const tryReveal = useCallback(() => {
    requestAnimationFrame(() => {
      if (!anchoring.current) return
      if (pendingBump.current && revealTries.current++ < 10) {
        tryReveal()
        return
      }
      anchoring.current = false
      isAtBottom.current = true
      setScrollY(scrollYRef.current)
      setReady(true)
    })
  }, [])

  const onContentSizeChange = useCallback(() => {
    // While anchoring, every size change (estimates -> real heights) must
    // be followed by a jump to the true bottom.
    if (!hasData) return
    if (anchoring.current) {
      scrollRef.current?.scrollToEnd({ animated: false })
      revealTries.current = 0
      tryReveal()
    } else if (isAtBottom.current) {
      // New item, or an item (e.g. a streaming AI reply) grew while we were
      // at the bottom: stay at the bottom, animated. `forcePin` keeps the
      // in-flight animation's intermediate offsets from clearing `isAtBottom`.
      forcePin.current = true
      scrollRef.current?.scrollToEnd({ animated: true })
    }
  }, [hasData, tryReveal])

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const y = contentOffset.y
    scrollYRef.current = y
    if (anchoring.current) return
    const atBottom =
      contentSize.height - layoutMeasurement.height - y <= AT_BOTTOM_THRESHOLD
    if (atBottom) {
      isAtBottom.current = true
      forcePin.current = false
    } else if (!forcePin.current) {
      isAtBottom.current = false
    }
    // The window has `overscanPx` of slack, so small moves need no render.
    setScrollY(prev => (Math.abs(y - prev) > 100 ? y : prev))
  }, [])

  const onScrollBeginDrag = useCallback(() => {
    forcePin.current = false
    // The user took over; stop forcing the bottom.
    if (anchoring.current) {
      anchoring.current = false
      setScrollY(scrollYRef.current)
      setReady(true)
    }
  }, [])

  const onScrollSettled = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = e.nativeEvent.contentOffset.y
      setScrollY(e.nativeEvent.contentOffset.y)
    },
    [],
  )

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setViewportHeight(e.nativeEvent.layout.height)
    // e.g. the keyboard opened or closed: keep the end in view.
    if (!anchoring.current && isAtBottom.current) {
      scrollRef.current?.scrollToEnd({ animated: false })
    }
  }, [])

  const items: React.ReactElement[] = []
  for (let i = first; i <= last; i++) {
    const key = keys[i]
    items.push(
      <View key={key} onLayout={e => onItemLayout(key, e)}>
        {renderItem({ item: data[i], index: i })}
      </View>,
    )
  }

  // `extraData` is intentionally read so that changes re-render this component.
  void extraData

  return (
    <ScrollView
      ref={scrollRef}
      style={[style, { opacity: ready || !hasData ? 1 : 0 }]}
      contentContainerStyle={contentContainerStyle}
      onLayout={onLayout}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollSettled}
      onMomentumScrollEnd={onScrollSettled}
      onContentSizeChange={onContentSizeChange}
      // Keeps the visible content stable when items above the viewport are
      // measured or when older messages are prepended. Index 0 is the top
      // spacer, so it is skipped.
      maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
      keyboardDismissMode="interactive"
    >
      <View style={{ height: topSpacer }} />
      {items}
      <View style={{ height: bottomSpacer }} />
    </ScrollView>
  )
}

const VirtualizedList = forwardRef(VirtualizedListInner) as <T>(
  props: Props<T> & { ref?: React.Ref<VirtualizedListHandle> },
) => React.ReactElement

export default VirtualizedList