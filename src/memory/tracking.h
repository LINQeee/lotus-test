#ifndef LOTUS_TEST_TRACKING_H
#define LOTUS_TEST_TRACKING_H

#include <stdlib.h>

void *trackedMalloc(size_t size);
void trackedFree(void *ptr);

#define malloc trackedMalloc
#define free trackedFree
#define lotusRegister registerRuntime

#endif
