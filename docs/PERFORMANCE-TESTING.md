# Performance Testing Guide for SQL Cell Optimizations

This guide describes how to test the SQL cell optimizations for handling large datasets.

## Optimizations Implemented

1. **Virtual Scrolling** - InteractiveResultTable now uses TanStack Virtual to render only visible rows
2. **Preview Mode** - SQL queries automatically limit results to 1000 rows with "Load All" option
3. **Pagination Support** - Infrastructure for loading data in pages (paginatedQuery.ts)
4. **IndexedDB Caching** - Query results cached using Dexie for faster repeated access (queryCache.ts)

## Generating Test Data

### Option 1: Using TypeScript Generator

```bash
cd workyy-fullproject-stable

# Generate 10K rows
npx ts-node scripts/generate-test-csv.ts 10000 test-data/test-10k.csv

# Generate 100K rows
npx ts-node scripts/generate-test-csv.ts 100000 test-data/test-100k.csv

# Generate 1M rows (large file ~100MB)
npx ts-node scripts/generate-test-csv.ts 1000000 test-data/test-1m.csv
```

### Option 2: Using Shell Script

```bash
cd workyy-fullproject-stable/test-data

# Generate different sizes
./generate-rows.sh 10000 test-10k.csv
./generate-rows.sh 100000 test-100k.csv
```

## Test Scenarios

### Scenario 1: Virtual Scrolling Performance

**Goal:** Verify UI remains responsive with large datasets

1. Upload `test-100k.csv` to a board
2. Run SQL: `SELECT * FROM test_100k`
3. Observe:
   - Initial render should be fast (< 500ms)
   - Scrolling should be smooth (60 fps)
   - Memory usage should be stable

**Expected Results:**
- Preview shows "1000 of 100K rows" badge
- Scrolling is smooth even with 100K rows in memory
- No browser freezing or lag

### Scenario 2: Preview Mode

**Goal:** Verify large results are automatically limited

1. Upload `test-100k.csv`
2. Run SQL: `SELECT * FROM test_100k`
3. Observe:
   - Result shows "Preview (1000 of 100K rows)"
   - "Load All" button appears
4. Click "Load All"
5. Observe:
   - All 100K rows load
   - Virtual scrolling still works

**Expected Results:**
- Initial query returns quickly (preview mode)
- "Load All" loads complete dataset
- UI remains responsive

### Scenario 3: Query Caching

**Goal:** Verify repeated queries use cache

1. Run SQL: `SELECT * FROM test_100k WHERE region = 'North'`
2. Note execution time
3. Run same query again
4. Note execution time

**Expected Results:**
- Second execution should be near-instant (from cache)
- Cache hit/miss stats available in browser console

### Scenario 4: Memory Management

**Goal:** Verify memory doesn't grow unboundedly

1. Open browser DevTools > Memory
2. Take heap snapshot
3. Upload and query multiple large CSVs
4. Take another heap snapshot
5. Compare memory usage

**Expected Results:**
- Memory should stabilize
- Old query results should be garbage collected
- IndexedDB cache should have TTL expiration

### Scenario 5: Plot Node with Large Data

**Goal:** Verify plot nodes stay smooth with full datasets without overloading the browser

1. Upload `test-100k.csv` (or run SQL that returns 50k+ rows)
2. Connect a Plot node to the SQL/CSV node
3. Choose Line, Area, or Scatter chart
4. Run the upstream node and observe the plot

**Expected Results:**
- Chart renders quickly (display uses downsampling: up to 5k points for line/area/scatter)
- Subtitle shows "Showing 5,000 of 100,000 points" when data is sampled
- Pan/zoom and tooltips remain responsive
- Full dataset is used for aggregation/filtering; only display is downsampled (LTTB for line/area, uniform for scatter)
- SQL full-load for plot is capped at 100k rows; CSV plot load uses same cap

## Performance Metrics to Track

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Time to First Render (TTFR) | < 500ms | DevTools Performance tab |
| Scroll FPS | 60 fps | DevTools Performance tab |
| Memory Peak | < 500MB for 100K rows | DevTools Memory tab |
| Cache Hit Rate | > 80% for repeated queries | Console logs |
| Preview Query Time | < 100ms | Console timing |

## Browser DevTools Tips

### Performance Tab
1. Open DevTools > Performance
2. Click Record
3. Perform action (scroll, query)
4. Stop recording
5. Analyze frame rate and scripting time

### Memory Tab
1. Open DevTools > Memory
2. Take heap snapshot before/after operations
3. Compare retained size
4. Look for memory leaks

### Console Logging
Enable query cache stats:
```javascript
// In browser console
import { getCacheStats } from '/apps/web/src/lib/queryCache';
console.log(getCacheStats());
```

## Known Limitations

1. **WASM Memory Limit**: DuckDB-WASM is limited to ~4GB memory
2. **OFFSET Performance**: Large OFFSET values can be slow in DuckDB
3. **IndexedDB Quota**: Browser may limit IndexedDB storage
4. **Large Files**: Files > 100MB may take time to load initially

## Troubleshooting

### Slow Initial Load
- Check network tab for file download time
- Consider using Parquet format for large files (better compression)

### Scroll Lag
- Verify TanStack Virtual is enabled (check for `useVirtualizer`)
- Check for expensive cell renderers

### Memory Issues
- Enable cache eviction
- Use preview mode instead of full load
- Close unused boards

## Future Improvements

1. **Arrow Streaming**: Use DuckDB's streaming API for very large results
2. **Web Workers**: Move query execution to worker thread
3. **Incremental Loading**: Load data as user scrolls (infinite scroll)
4. **Parquet Optimization**: Use HTTP range requests for Parquet files
