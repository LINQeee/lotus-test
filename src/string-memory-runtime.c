#include <assert.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>

#include "lotus.h"

static int liveBlocks;
static int peakBlocks;

static void *trackedMalloc(size_t size) {
    void *ptr = malloc(size);
    assert(ptr);
    liveBlocks++;
    if (liveBlocks > peakBlocks) peakBlocks = liveBlocks;
    return ptr;
}

static void trackedFree(void *ptr) {
    if (ptr) liveBlocks--;
    free(ptr);
}

#define malloc trackedMalloc
#define free trackedFree
#define lotusRegister registerRuntime
#include "library.c"
#undef lotusRegister
#undef free
#undef malloc

LotusString *nativeAlias(LotusString *str) {
    _stringRetain(str);
    return str;
}

LOTUS_NATIVE_LIBRARY {
    registerRuntime(reg);
    LOTUS_FUNCTION(nativeAlias, LOTUS_STRING, LOTUS_STRING);
}

__attribute__((destructor)) static void verifyStringMemory(void) {
    fflush(stdout);
    fprintf(stderr, "String memory: live=%d peak=%d\n", liveBlocks, peakBlocks);
    assert(liveBlocks == 0);
    assert(peakBlocks < 80);
}
