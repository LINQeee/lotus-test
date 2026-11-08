#include <assert.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>

#include "lotus.h"

#undef malloc
#undef free
#undef lotusRegister

void registerRuntime(RegisterFunction reg);
void _stringRetain(LotusString *str);

static int liveBlocks;
static int peakBlocks;

void *trackedMalloc(size_t size) {
    void *ptr = malloc(size);
    assert(ptr);
    liveBlocks++;
    if (liveBlocks > peakBlocks) peakBlocks = liveBlocks;
    return ptr;
}

void trackedFree(void *ptr) {
    if (ptr) liveBlocks--;
    free(ptr);
}

LotusString *nativeAlias(LotusString *str) {
    _stringRetain(str);
    return str;
}

double nativeAdd(double left, double right) {
    return left + right;
}

int nativeSum(int count, ...) {
    va_list args;
    va_start(args, count);
    int sum = 0;
    for (int i = 0; i < count; i++) sum += va_arg(args, int);
    va_end(args);
    return sum;
}

LOTUS_NATIVE_LIBRARY {
    registerRuntime(reg);
    LOTUS_FUNCTION(nativeAlias, LOTUS_STRING, LOTUS_STRING);
    LOTUS_FUNCTION(nativeAdd, LOTUS_F64, LOTUS_F64, LOTUS_F64);
    LOTUS_VARIADIC(nativeSum, LOTUS_I32, LOTUS_I32);
}

__attribute__((destructor)) static void verifyStringMemory(void) {
    fflush(stdout);
    fprintf(stderr, "String memory: live=%d peak=%d\n", liveBlocks, peakBlocks);
    assert(liveBlocks == 0);
    assert(peakBlocks < 80);
}
