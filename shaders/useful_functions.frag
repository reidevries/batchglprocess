#version 330

// Input vertex attributes (from vertex shader)
in vec2 fragTexCoord;
in vec4 fragColor;

// Input uniform values
uniform sampler2D texture0;

uniform vec4 colDiffuse;
uniform vec2 resolution;

//progress, in frames
uniform int progress;

// Output fragment color
out vec4 finalColor;


/// calculates a bell curve that always has a max at 1
float bell(in float x, in float width, in float centre) {
	return exp(-pow((x-centre)/width, 2)/2);
}

//makes a triangle wave, from 0 to 1, for 0 < f < 1 output is the same as input
//doesnt work if f < -10
float makeTri(in float f) {
	float tri = 1-abs(1-float(int(f*3142+6284*10)%6284)/3142);
	return tri;
}

//swap two colors. if fader=1.0, they are swapped, if fade = 0.0, they are not
void swapColors(inout vec3 a, inout vec3 b, in float fader)
{
	a = mix(a, b, fader);
	b = mix(b, a, fader);
}

//rgb<->hsv conversion
vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}



//size of the output image relative to the input sampler2D
vec2 window_size = vec2(0.5f, 0.333f);
//enum kinda thing to select windows
vec2 window_fg       = vec2(0,2);
vec2 window_fg_prev  = vec2(1,2);
vec2 window_bg       = vec2(0,1);
vec2 window_bg_prev  = vec2(1,1);
vec2 window_out_prev = vec2(0,0);
vec2 window_out_old  = vec2(0,1);

//flip coords when they get to the edge of the window section
vec2 edgeMirror(in vec2 tex_coord) {
	vec2 out_coord = tex_coord/window_size;
	out_coord = vec2(makeTri(out_coord.x), makeTri(out_coord.y))*window_size;
	out_coord = max(out_coord, vec2(0.001f)); //removes weird line at bottom of the screen
	return out_coord;
}

//get coords within a specific window (fg, bg, prev, etc)
vec2 windowCoord(in vec2 coord, in vec2 window) {
	return edgeMirror(coord) + window*window_size;
}

//soble edge detection function
mat3 sx = mat3(
    1.0, 2.0, 1.0,
    0.0, 0.0, 0.0,
   -1.0, -2.0, -1.0
);
mat3 sy = mat3(
    1.0, 0.0, -1.0,
    2.0, 0.0, -2.0,
    1.0, 0.0, -1.0
);
vec3 sobel(in vec2 coord, in vec2 window, in float spread) {
	mat3 I;
	for (int i=0; i<3; i++) {
        for (int j=0; j<3; j++) {
			vec2 samp_coord = vec2(i-1,j-1)*spread + coord;
            vec3 samp  = texture(texture0, windowCoord(samp_coord,window)).rgb;
            I[i][j] = length(samp);
		}
	}

	float gx = dot(sx[0], I[0]) + dot(sx[1], I[1]) + dot(sx[2], I[2]);
	float gy = dot(sy[0], I[0]) + dot(sy[1], I[1]) + dot(sy[2], I[2]);

	return vec3(gx, gy, 1-gx*gx-gy*gy);
}

vec3 multisobel(in vec2 coord, in vec2 window, in float spread, in int n) {
	vec3 acc = vec3(0);
	for (int u=0; u<n; ++u) {
		for (int v=0; v<n; ++v) {
			vec2 offset = spread*vec2(u,v)/vec2(n);
			acc = acc + sobel(coord+offset/resolution, window, spread);
		}
	}
	return acc/(n*n);
}

vec3 absDiff(in vec3 a, in vec3 b) {
	return vec3(abs(a.r-b.r), abs(a.g-b.g), abs(a.b-b.b));
}

float absDiff2(in vec3 a, in vec3 b) {
	vec3 rgb = absDiff(a,b);
	return (rgb.r + rgb.g + rgb.b)/3.0;
}

float expSim(in float a, in float b, in float specificity) {
    return exp(-specificity*abs(a-b));
}

vec2 fourQuadNormalise(in vec2 v) {
	float rad = atan(v.y, v.x);
	return vec2(cos(rad), sin(rad));
}
