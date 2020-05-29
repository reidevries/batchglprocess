#include "raylib.h"
#include <iostream>
#include <stdlib.h>
#include <string.h>
#include <vector>
#include <sstream>
#include <cmath>
#include <unistd.h>
#include <iomanip>
#include <getopt.h>
#include <filesystem>
#include <algorithm>

Vector2 resolution = {1280,720};
std::string input_dir_fg = "in_fg/";
std::string input_dir_bg = "in_bg/";
std::string output_dir = "out/";
std::string out_filetype = "png";
std::string in_filetype = "png";
std::string shader_path = "shaders/base.frag";
int digit_num = 5;
bool swap_fg_bg = false;
bool preview_mode = false;
unsigned int batch_size = 8;
unsigned int num_frames_back = 1;

namespace fs = std::filesystem;

/* gets a filename from a dir. The files should be named
 * as integers with width of digit_num and with the given
 * filetype suffix.
 */

std::string getFileName(std::string dir,
		int index,
		std::string filetype) {
	std::stringstream filename;
	filename << dir;
	filename << std::setfill('0') << std::setw(digit_num) << index;
	filename << "." << filetype;
	return filename.str();
}

/* processes a vector of textures thru the given shader.
 * tex_buf is fg,bg.
 * num_frames_back is how many frames ago "processed_older" is taken from
 * starting_index is for log messages.
 */
std::vector<Image> processTextures(
		std::vector<std::pair<Texture2D,Texture2D>> tex_buf,
		std::pair<Texture2D,Texture2D> last_batch_pair,
		std::vector<Image> out_buf,
		Shader s,
		int starting_index) {

	// Create a RenderTexture2D to use as a canvas
    RenderTexture2D sampler = LoadRenderTexture(resolution.x*2, resolution.y*3);
	RenderTexture2D target = LoadRenderTexture(resolution.x, resolution.y);
	
	//iterate through all the textures in the vector
	int log_index = starting_index;
	Texture2D fg, bg;
	Texture2D fg_previous = last_batch_pair.first;
	Texture2D bg_previous = last_batch_pair.second;
	Texture2D processed_previous = tex_buf.front().first;
	Texture2D processed_older = tex_buf.front().second;

	std::cout << "processing inputs " << starting_index << " to " << (starting_index+tex_buf.size()) << std::endl;
	for (auto it = tex_buf.begin(); it != tex_buf.end(); ++it) {
		std::cout << "\tprocessing " << std::setfill('0') << std::setw(digit_num) << log_index << "/" << out_buf.size() << "... " << std::endl;

		if (swap_fg_bg) {
			fg = it->second;
			bg = it->first;
			if (it != tex_buf.begin()) {
				fg_previous = (it-1)->second;
				bg_previous = (it-1)->first;
			}
		} else {
			fg = it->first;
			bg = it->second;
			if (it != tex_buf.begin()) {
				fg_previous = (it-1)->first;
				bg_previous = (it-1)->second;
			}
		}


		if (out_buf.size() > 1) {
			processed_previous = LoadTextureFromImage(*(out_buf.end()-1));
			//if num_frames_back > out.size, return the texture using modulo operation
			if (out_buf.size() > num_frames_back) {
				processed_older = LoadTextureFromImage(*(out_buf.end()-1-num_frames_back));
			} else processed_older = LoadTextureFromImage(out_buf.back());
		}

		/* raylib doesn't allow uploading sampler2Ds to GPU.
		 * so instead, I draw the necessary textures to a very tall render
		 * texture called "sampler with textures arranged like this:
		 * 		current foreground texture	|	previous foreground texture
		 * 		current background texture	|	previous background texture
		 * 		previous processed texture	|	older processed texture
		 */
		BeginTextureMode(sampler);
			ClearBackground(WHITE);
			DrawTexture(fg, 				0, 				0, 				WHITE);
			DrawTexture(fg_previous, 		resolution.x, 	0, 				WHITE);
			DrawTexture(bg, 				0, 				resolution.y, 	WHITE);
			DrawTexture(bg_previous,		resolution.x,	resolution.y,	WHITE);
			DrawTexture(processed_previous,	0,				resolution.y*2,	WHITE);
			DrawTexture(processed_older,	resolution.x,	resolution.y*2,	WHITE);
		EndTextureMode();
		
		//unload the temporary textures
		UnloadTexture(processed_previous);
		UnloadTexture(processed_older);

		SetShaderValue(s, GetShaderLocation(s, "progress"), &log_index, UNIFORM_INT);

		//now apply the shader and render to target texture
		BeginTextureMode(target);
			ClearBackground(WHITE);
			BeginShaderMode(s);
				DrawTexture(sampler.texture, 0, 0, WHITE);
			EndShaderMode();
		EndTextureMode();

		out_buf.push_back(GetTextureData(target.texture));
		
		//finally, draw on the screen
		BeginDrawing();
			DrawTexture(target.texture, 0, 0, WHITE);
		EndDrawing();

		++log_index;
	}

	UnloadRenderTexture(sampler);
	UnloadRenderTexture(target);

	std::cout << std::endl;
	return out_buf;
}

/*saves and unloads a vector of textures to output_dir*/
void saveTextures(std::vector<Image> out_buf, int starting_index) {
	if (!preview_mode) {
	std::cout << "saving images:" << std::endl;

	unsigned int log_index = starting_index;
	std::string filename;
	for (auto it = out_buf.begin()+starting_index; it != out_buf.end(); ++it) {
		filename = getFileName(output_dir, log_index, out_filetype);
		std::cout << "\tsaving image to filename " << filename << std::endl;

		Image image = *it;
		ExportImage(image, filename.c_str());
		++log_index;
	}
	std::cout << std::endl;
	}
}

/*unload all the textures in the given buffer*/
void unloadTextures(std::vector<std::pair<Texture2D, Texture2D>> tex_buf) {
	for (auto it : tex_buf) {
		UnloadTexture(it.first);
		UnloadTexture(it.second);
	}
}

void unloadAllButLastTexture(std::vector<std::pair<Texture2D, Texture2D>> tex_buf) {
	for (auto it = tex_buf.begin(); it != tex_buf.end()-1; ++it) {
		UnloadTexture(it->first);
		UnloadTexture(it->second);
	}
}

//copied+edited from Gnu getopt manual (https://www.gnu.org/software/libc/manual/html_node/Getopt-Long-Option-Example.html#Getopt-Long-Option-Example)
void processArgs(int argc, char* argv[]) {
	struct option long_options[] = {
		/* These options don’t set a flag.
		 We distinguish them by their indices. */
		{"inputdirfg", required_argument, 0, 'a'},
		{"inputdirbg", required_argument, 0, 'b'},
		{"outputdir", required_argument, 0, 'o'},
		{"shader", required_argument, 0, 's'},
		{"filetype", required_argument, 0, 'f'},
		{"numframes", required_argument, 0, 'n'},
		{"delay", required_argument, 0, 'd'},
		{"width", required_argument, 0, 'w'},
		{"height", required_argument, 0, 'h'},
		{"swap", no_argument, 0, 'c'},
		{"preview", no_argument, 0, 'p'}
	};

	std::cout << "Usage: " << argv[0] << " [arguments]" << std::endl;
	std::cout << "valid arguments:" << std::endl;
	std::cout << "-a --inputdirfg sets the input directory for foreground frames" << std::endl;
	std::cout << "-b --inputdirbg sets the input directory for background frames" << std::endl;
	std::cout << "-o --outputdir sets the directory for output frames" << std::endl;
	std::cout << "-s --shader sets the filename of the fragment shader" << std::endl;
	std::cout << "-f --filetype sets the filetype (only tested with png so far)" << std::endl;
	std::cout << "-n --numframes sets the number of frames to store in memory at once" << std::endl;
	std::cout << "\t(defaults to 8)" << std::endl;
	std::cout << "-d --delay sets the delay for processed_older frame, only affects some filters" << std::endl;
	std::cout << "\t(defaults to 1)" << std::endl;
	std::cout << "-w --width sets the frame width in pixels" << std::endl;
	std::cout << "-h --height sets the frame height in pixels" << std::endl;
	std::cout << "\t(defaults to 1280x720)" << std::endl;
	std::cout << "-c --swap swaps the foreground/background inputs to the shader" << std::endl;
	std::cout << "-p --preview run in preview mode, don't save images just play the effect" << std::endl;

	/* getopt_long stores the option index here. */
	int option_index = 0;
	int c;
	while ((c = getopt_long(argc, argv, "a:b:o:s:f:n:d:w:h:cp", long_options, &option_index)) != -1) {
		switch (c) {
			case 0:
				std::cout << "idk what this means, something's funny with ur args" << std::endl;
				break;
			case 'a':
				input_dir_fg = optarg;
				if (input_dir_fg[input_dir_fg.size()-1] != '/') {
					std::cout << "u specified a file, not a directory. pls try again" << std::endl;
					abort();
				}
				break;
			case 'b':
				input_dir_bg = optarg;
				if (input_dir_bg[input_dir_bg.size()-1] != '/') {
					std::cout << "u specified a file, not a directory. pls try again" << std::endl;
					abort();
				}
				break;
			case 'o':
				output_dir = optarg;
				if (output_dir[output_dir.size()-1] != '/') {
					std::cout << "u specified a file, not a directory. pls try again" << std::endl;
					abort();
				}
				break;
			case 's':
				shader_path = optarg;
				if (shader_path[shader_path.size()-1] == '/') {
					std::cout << "u specified a directory, pls specify the frag shader filename instead" << std::endl;
					abort();
				}
				break;
			case 'f':
				out_filetype = optarg;
				in_filetype = optarg;
				break;
			case 'n':
				batch_size = std::stoi(optarg);
				break;
			case 'd':
				num_frames_back = std::stoi(optarg);
				break;
			case 'w':
				resolution.x = std::stoi(optarg);
				break;
			case 'h':
				resolution.y = std::stoi(optarg);
				break;
			case 'c':
				swap_fg_bg = true;
				std::cout << "swapping foreground and background" << std::endl;
				break;
			case 'p':
				preview_mode = true;
				std::cout << "running in preview mode - no saving images" << std::endl;
				break;
			case '?':
			  break;

			default:
			  abort ();
		}
	}
}

int main(int argc, char* argv[]) {
	std::cout << argv[0] << " by Rei de Vries June 2020" << std::endl;
	processArgs(argc, argv);

	//only show warning messages, not every debug message
	SetTraceLogLevel(LOG_WARNING);

	//initialize window with raylib
	InitWindow(resolution.x, resolution.y, "processing video frames...");
	
	//load the shader and set its resolution variable
	Shader s = LoadShader("shaders/base.vert", shader_path.c_str());
	SetShaderValue(s, GetShaderLocation(s, "resolution"), &resolution, UNIFORM_VEC2);

	//variables for storing textures and image pairs
	std::vector<std::pair<Texture2D, Texture2D>> tex_buf;
	std::vector<Image> out_buf; //stored in main memory, not gpu memory
	Image cur_image_fg, cur_image_bg;
	std::pair<Texture2D, Texture2D> last_batch_pair; //stores the last frames from the last batch

	//iterator for image filenames
	int index = 0;
	int image_i = 1;
	int bg_image_i = 1;
	int last_saved_index = 0;

	//load images in the input folders
	std::vector<std::string> fg_paths;
	std::vector<std::string> bg_paths;
	std::cout << "scanning foregrounds in " << input_dir_fg << ": " << std::endl;
	for (auto& p: fs::directory_iterator(input_dir_fg)) {
		if (p.path().extension().compare(".png") == 0) {
			fg_paths.push_back(p.path().string());
		}
	}
	std::cout << "loaded " << fg_paths.size() << " foregrounds" << std::endl;
	std::cout << "scanning backgrounds in " << input_dir_bg << ": " << std::endl;
	for (auto& p: fs::directory_iterator(input_dir_bg)) {
		if (p.path().extension().compare(".png") == 0) {
			bg_paths.push_back(p.path().string());
		}
	}
	std::cout << "loaded " << bg_paths.size() << " backgrounds" << std::endl;
	//sort the paths
	std::sort(fg_paths.begin(), fg_paths.end());
	std::sort(bg_paths.begin(), bg_paths.end());

	std::cout << "beginning processing with batch size " << batch_size << "..." << std::endl;
	//check the number of frames
	if (fg_paths.size() < bg_paths.size()) {
		std::cout << " there are more background frames than foreground frames, " << std::endl
				<< " algorithm will stop processing after running out of foreground frames"
				<< std::endl;
	} else if (fg_paths.size() > bg_paths.size()) {
		std::cout << " there are more foreground frames than background frames, " << std::endl
				<< " background will loop to beginning when frames run out" << std::endl;
	}

	while (access(fg_paths[index].c_str(), R_OK) != -1 ) {
		cur_image_fg = LoadImage(fg_paths[index].c_str());
		cur_image_bg = LoadImage(bg_paths[index%bg_paths.size()].c_str());

		//format images to 32 bit uncompressed
		ImageFormat(&cur_image_fg, UNCOMPRESSED_R8G8B8A8);
		ImageFormat(&cur_image_bg, UNCOMPRESSED_R8G8B8A8);
		//upload images to gpu and place them in the texture buffer
		tex_buf.push_back(
			std::pair<Texture2D, Texture2D>(
				LoadTextureFromImage(cur_image_fg),
				LoadTextureFromImage(cur_image_bg)
			)
		);
		//images are now stored as textures in vram so we can unload them
		UnloadImage(cur_image_fg);
		UnloadImage(cur_image_bg);
		
		//batch process the texture buffer if we exceeded the maximum size
		if (tex_buf.size() >= batch_size) {
			if (last_saved_index == 0) last_batch_pair = tex_buf[0];
			out_buf = processTextures(tex_buf, last_batch_pair, out_buf, s, last_saved_index);
			saveTextures(out_buf, last_saved_index);
			unloadAllButLastTexture(tex_buf);
			last_batch_pair = tex_buf.back();
			tex_buf.clear();
			last_saved_index = index+1;
			std::cout << "batch processed " << batch_size << " frames" << std::endl << std::endl;
		}
		++image_i;
		++bg_image_i;
		++index;
	}

	std::cout << std::endl;
	if (last_saved_index == 0) last_batch_pair = tex_buf[0];
	out_buf = processTextures(tex_buf, last_batch_pair, out_buf, s, last_saved_index);
	saveTextures(out_buf, last_saved_index);
	for (auto out_tex : out_buf) UnloadImage(out_tex);
	unloadTextures(tex_buf);
	tex_buf.clear();
	UnloadShader(s);
	std::cout << "done" << std::endl;
}
