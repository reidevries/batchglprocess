cmake_minimum_required(VERSION 3.17)
cmake_policy(VERSION 3.17)
project(batchglprocess VERSION 0.1)

set(OUTPUT_EXT "")
add_executable(${PROJECT_NAME} "")
target_sources(${PROJECT_NAME} PRIVATE processvid.cpp)

target_compile_features(${PROJECT_NAME}
    PRIVATE
    cxx_std_17
)
set(CMAKE_CXX_STANDARD 17) 		#needs C++17 for filesystem

#find, optionally download, and (re-)build raylib
add_subdirectory("${CMAKE_SOURCE_DIR}/raylib-3.7.0" "${CMAKE_SOURCE_DIR}/raylib-3.7.0-build")
#Use ASAN sanitization flags
if (USE_SANITIZER_ASAN)
	SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=leak -fsanitize=address -fno-omit-frame-pointer -fsanitize=undefined")
endif()

target_compile_options(${PROJECT_NAME}
	PRIVATE
	-Wall -Wextra -Wpedantic
)

target_include_directories(${PROJECT_NAME}
	PUBLIC
	"${CMAKE_SOURCE_DIR}/raylib-3.7.0-build/src"
	"${PROJECT_BINARY_DIR}"
)

target_link_libraries(${PROJECT_NAME} raylib_static)
