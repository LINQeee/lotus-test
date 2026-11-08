cmake_minimum_required(VERSION 4.2)
project(lotus_memory_test C)

add_subdirectory("${LOTUS_CORE_SOURCE}" core)
target_sources(lotus_core PRIVATE "${CMAKE_CURRENT_LIST_DIR}/../string-memory-runtime.c")
target_compile_options(lotus_core PRIVATE
        -g -O1 -fsanitize=address,undefined
        -include "${CMAKE_CURRENT_LIST_DIR}/tracking.h")
target_link_options(lotus_core PRIVATE -fsanitize=address,undefined)
set_target_properties(lotus_core PROPERTIES
        OUTPUT_NAME memory
        LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
