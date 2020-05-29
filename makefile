CC=g++
CFLAGS= -std=c++17 -lraylib -lglfw -lGL -lopenal -lm -pthread -ldl -g -O0
CWARNINGS=-Wall -Wextra -Wshadow -Wnon-virtual-dtor -pedantic

all: processvid.cpp
	$(CC) -o batchglprocess $^ $(CFLAGS) $(CWARNINGS)

clean:
	rm -f batchglprocess
