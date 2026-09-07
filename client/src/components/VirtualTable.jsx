import { useState, useEffect, useRef, useMemo, useCallback } from "react";

/**
 * Lightweight, zero-dependency virtual table/list component.
 * Renders only visible rows + overscan buffer based on scroll offset.
 *
 * @param {Array} items - Full list of data items
 * @param {number} itemHeight - Height of each row in px (default: 56)
 * @param {Function} renderRow - Render prop: (item, index, virtualIndex) => ReactNode
 * @param {number} overscan - Extra rows rendered above/below viewport (default: 5)
 * @param {number|string} maxHeight - Max height of scroll container in px or CSS string (default: 540)
 * @param {React.ReactNode} header - Header component pinned above virtualized rows
 * @param {React.ReactNode} emptyMessage - Message displayed when items list is empty
 * @param {string} className - Optional className for outer container
 * @param {Object} style - Custom inline styles for outer container
 */
const VirtualTable = ({
  items = [],
  itemHeight = 56,
  renderRow,
  overscan = 5,
  maxHeight = 540,
  header = null,
  emptyMessage = null,
  className = "",
  style = {},
}) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(
    typeof maxHeight === "number" ? maxHeight : 540
  );

  // Measure container height dynamically
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setContainerHeight(el.clientHeight);
      }
    };

    updateHeight();

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(el);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalCount = items.length;
  const totalHeight = totalCount * itemHeight;

  const { startIndex, endIndex, offsetY, visibleItems } = useMemo(() => {
    if (totalCount === 0) {
      return { startIndex: 0, endIndex: 0, offsetY: 0, visibleItems: [] };
    }

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan;
    const end = Math.min(totalCount - 1, start + visibleCount);

    const slice = items.slice(start, end + 1).map((item, idx) => ({
      item,
      virtualIndex: start + idx,
    }));

    return {
      startIndex: start,
      endIndex: end,
      offsetY: start * itemHeight,
      visibleItems: slice,
    };
  }, [items, totalCount, itemHeight, scrollTop, containerHeight, overscan]);

  if (totalCount === 0 && emptyMessage) {
    return (
      <div style={{ ...styles.container, maxHeight, ...style }} className={className}>
        {header}
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={className}
      style={{
        ...styles.container,
        maxHeight,
        ...style,
      }}
    >
      {header && <div style={styles.stickyHeader}>{header}</div>}

      <div style={{ ...styles.scrollTrack, height: totalHeight, minHeight: "100%" }}>
        <div
          style={{
            ...styles.virtualWindow,
            transform: `translateY(${offsetY}px)`,
          }}
        >
          {visibleItems.map(({ item, virtualIndex }) =>
            renderRow(item, virtualIndex)
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: "relative",
    overflowY: "auto",
    overflowX: "auto",
    width: "100%",
    willChange: "transform",
    WebkitOverflowScrolling: "touch",
  },
  stickyHeader: {
    position: "sticky",
    top: 0,
    zIndex: 3,
    background: "#fff",
  },
  scrollTrack: {
    position: "relative",
    width: "100%",
  },
  virtualWindow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
  },
};

export default VirtualTable;
