#define _POSIX_C_SOURCE 200809L
#define _XOPEN_SOURCE 700
#include <node_api.h>
#include <sys/stat.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>

#define MAX_BATCH 32
#define ROW_BYTES 48
/* Own all inputs: JavaScript may mutate or detach buffers while work runs. */
typedef struct {
  napi_async_work work;
  napi_deferred deferred;
  size_t count;
  char *paths[MAX_BATCH];
  uint8_t targets[MAX_BATCH];
  uint64_t expected[MAX_BATCH][6];
  uint32_t checked;
  int error;
  size_t error_index;
  int matches;
} Batch;

static void release(Batch *batch) {
  for (size_t i = 0; i < batch->count; i++) free(batch->paths[i]);
  free(batch);
}

static uint64_t read_le(const uint8_t *bytes) {
  uint64_t value = 0;
  for (size_t i = 0; i < 8; i++) value |= (uint64_t)bytes[i] << (i * 8);
  return value;
}

#include "timestamp.h"

static int fields(const struct stat *stat, uint64_t values[6]) {
  values[0] = (uint64_t)stat->st_dev;
  values[1] = (uint64_t)stat->st_ino;
  values[2] = (uint64_t)stat->st_size;
  values[3] = (uint64_t)stat->st_mode;
#ifdef __APPLE__
  return timestamp(stat->st_mtimespec.tv_sec, stat->st_mtimespec.tv_nsec, &values[4]) &&
         timestamp(stat->st_ctimespec.tv_sec, stat->st_ctimespec.tv_nsec, &values[5]);
#else
  return timestamp(stat->st_mtim.tv_sec, stat->st_mtim.tv_nsec, &values[4]) &&
         timestamp(stat->st_ctim.tv_sec, stat->st_ctim.tv_nsec, &values[5]);
#endif
}

static void run(napi_env env, void *data) {
  (void)env;
  Batch *batch = data;
  batch->matches = 1;
  for (size_t i = 0; i < batch->count; i++) {
    char *resolved = NULL;
    const char *filename = batch->paths[i];
    if (batch->targets[i]) {
      resolved = realpath(filename, NULL);
      if (resolved) filename = resolved;
    }
    struct stat stat;
    int failed = batch->targets[i] && !resolved ? -1 : lstat(filename, &stat);
    int code = failed ? errno : 0;
    free(resolved);
    if (failed) {
      batch->matches = 0;
      if (code != ENOENT && code != ENOTDIR && !batch->error) {
        batch->error = code;
        batch->error_index = i;
      }
      continue;
    }
    batch->checked++;
    uint64_t observed[6];
    if (!fields(&stat, observed) || memcmp(observed, batch->expected[i], sizeof(observed))) batch->matches = 0;
  }
}

static void done(napi_env env, napi_status status, void *data) {
  Batch *batch = data;
  napi_value result, value;
  if (status != napi_ok || batch->error) {
    const char *message = batch->error ? strerror(batch->error) : "Native metadata work was cancelled";
    napi_create_string_utf8(env, message, NAPI_AUTO_LENGTH, &value);
    napi_create_error(env, NULL, value, &result);
    napi_create_int32(env, batch->error, &value);
    napi_set_named_property(env, result, "nativeErrno", value);
    if (batch->error) {
      napi_create_string_utf8(env, batch->paths[batch->error_index], NAPI_AUTO_LENGTH, &value);
      napi_set_named_property(env, result, "path", value);
    }
    napi_reject_deferred(env, batch->deferred, result);
  } else {
    napi_create_object(env, &result);
    napi_get_boolean(env, batch->matches, &value);
    napi_set_named_property(env, result, "matches", value);
    napi_create_uint32(env, batch->checked, &value);
    napi_set_named_property(env, result, "checked", value);
    napi_resolve_deferred(env, batch->deferred, result);
  }
  napi_delete_async_work(env, batch->work);
  release(batch);
}

static napi_value invalid(napi_env env, Batch *batch) {
  release(batch);
  napi_throw_type_error(env, NULL, "Expected at most 32 NUL-free paths, target bytes and six uint64 metadata fields per path");
  return NULL;
}

static napi_value check(napi_env env, napi_callback_info info) {
  napi_value args[3], promise, name;
  size_t argc = 3;
  if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok || argc != 3) {
    napi_throw_type_error(env, NULL, "Expected paths, targets and metadata");
    return NULL;
  }
  Batch *batch = calloc(1, sizeof(Batch));
  if (!batch) { napi_throw_error(env, NULL, "Native metadata allocation failed"); return NULL; }
  uint32_t count;
  bool array;
  if (napi_is_array(env, args[0], &array) != napi_ok || !array ||
      napi_get_array_length(env, args[0], &count) != napi_ok || count > MAX_BATCH) return invalid(env, batch);
  batch->count = count;
  bool buffer;
  void *targets, *baseline;
  size_t target_bytes, baseline_bytes;
  if (napi_is_buffer(env, args[1], &buffer) != napi_ok || !buffer ||
      napi_get_buffer_info(env, args[1], &targets, &target_bytes) != napi_ok || target_bytes != count ||
      napi_is_buffer(env, args[2], &buffer) != napi_ok || !buffer ||
      napi_get_buffer_info(env, args[2], &baseline, &baseline_bytes) != napi_ok || baseline_bytes != count * ROW_BYTES)
    return invalid(env, batch);
  if (count) memcpy(batch->targets, targets, count);
  /* Decode every row before getters can transfer/detach the baseline buffer. */
  for (size_t i = 0; i < count; i++) {
    if (batch->targets[i] > 1) return invalid(env, batch);
    for (size_t field = 0; field < 6; field++)
      batch->expected[i][field] = read_le((uint8_t *)baseline + i * ROW_BYTES + field * 8);
  }
  for (size_t i = 0; i < count; i++) {
    napi_value item;
    napi_valuetype type;
    size_t length, written;
    if (napi_get_element(env, args[0], i, &item) != napi_ok ||
        napi_typeof(env, item, &type) != napi_ok || type != napi_string ||
        napi_get_value_string_utf8(env, item, NULL, 0, &length) != napi_ok || length > 1048576)
      return invalid(env, batch);
    batch->paths[i] = malloc(length + 1);
    if (!batch->paths[i]) { release(batch); napi_throw_error(env, NULL, "Native path allocation failed"); return NULL; }
    if (napi_get_value_string_utf8(env, item, batch->paths[i], length + 1, &written) != napi_ok ||
        written != length || memchr(batch->paths[i], 0, length)) return invalid(env, batch);
  }
  if (napi_create_promise(env, &batch->deferred, &promise) != napi_ok ||
      napi_create_string_utf8(env, "vitest-cache metadata", NAPI_AUTO_LENGTH, &name) != napi_ok ||
      napi_create_async_work(env, NULL, name, run, done, batch, &batch->work) != napi_ok) {
    release(batch); napi_throw_error(env, NULL, "Cannot create native metadata work"); return NULL;
  }
  if (napi_queue_async_work(env, batch->work) != napi_ok) {
    napi_delete_async_work(env, batch->work);
    release(batch); napi_throw_error(env, NULL, "Cannot queue native metadata work"); return NULL;
  }
  return promise;
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value function;
  if (napi_create_function(env, "check", NAPI_AUTO_LENGTH, check, NULL, &function) != napi_ok ||
      napi_set_named_property(env, exports, "check", function) != napi_ok) return NULL;
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
