#ifndef VITEST_CACHE_TIMESTAMP_H
#define VITEST_CACHE_TIMESTAMP_H
#include <stdint.h>
/* Fail closed rather than aliasing unsupported timestamps modulo 2^64. */
static int timestamp(int64_t seconds, long nanos, uint64_t *value) {
  if (nanos < 0 || nanos >= 1000000000 || seconds < -9223372037LL || seconds > 9223372036LL ||
      (seconds == -9223372037LL && nanos < 145224192) ||
      (seconds == 9223372036LL && nanos > 854775807)) return 0;
  int64_t result = seconds < 0 ? (seconds + 1) * 1000000000 - (1000000000 - nanos)
                               : seconds * 1000000000 + nanos;
  *value = (uint64_t)result;
  return 1;
}

#endif
