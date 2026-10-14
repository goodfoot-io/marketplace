#include <assert.h>
#include "../native/timestamp.h"
int main(void) {
  uint64_t value;
  assert(timestamp(0, 0, &value) && value == 0);
  assert(timestamp(-1, 999999999, &value) && value == UINT64_MAX);
  assert(timestamp(-9223372037LL, 145224192, &value) && value == (uint64_t)INT64_MIN);
  assert(timestamp(9223372036LL, 854775807, &value) && value == (uint64_t)INT64_MAX);
  assert(!timestamp(-9223372037LL, 145224191, &value));
  assert(!timestamp(9223372036LL, 854775808, &value));
  assert(!timestamp(INT64_MIN, 0, &value));
  assert(!timestamp(INT64_MAX, 0, &value));
  assert(!timestamp(0, -1, &value));
  assert(!timestamp(0, 1000000000, &value));
  assert(!timestamp(18446744073LL, 709551616, &value));
  return 0;
}
