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

//flip coords when they get to the edge of the window section
vec2 edgeMirror(in vec2 tex_coord) {
	vec2 out_coord = tex_coord/window_size;
	out_coord = vec2(makeTri(out_coord.x), makeTri(out_coord.y))*window_size;
	out_coord = max(out_coord, vec2(0.001f)); //removes weird line at bottom of the screen
	return out_coord;
}

//translate coordinates to various sampler sections----//
vec2 fgCoord(in vec2 tex_coord) {
	return edgeMirror(tex_coord) + vec2(0, window_size.y*2);
}

vec2 fgPrevCoord(in vec2 tex_coord) {
	return edgeMirror(tex_coord) + vec2(window_size.x, window_size.y*2);
}

vec2 bgCoord(in vec2 tex_coord) {
	return edgeMirror(tex_coord) + vec2(0, window_size.y);
}

vec2 bgPrevCoord(in vec2 tex_coord) {
	return edgeMirror(tex_coord) + vec2(window_size.x, window_size.y);
}

vec2 outPrevCoord(in vec2 tex_coord) {
	return edgeMirror(tex_coord);
}

vec2 outOldCoord(in vec2 tex_coord) {
	return edgeMirror(tex_coord) + vec2(window_size.x, 0);
}
//-----------------------------------------------------//

vec3 absDiff(in vec3 a, in vec3 b) {
	return vec3(abs(a.r-b.r), abs(a.g-b.g), abs(a.b-b.b));
}

float absDiff2(in vec3 a, in vec3 b) {
	vec3 rgb = absDiff(a,b);
	return (rgb.r + rgb.g + rgb.b)/3.0;
}

vec2 fourQuadNormalise(in vec2 v) {
	float rad = atan(v.y, v.x);
	return vec2(cos(rad), sin(rad));
}

void main()
{
	float timer_ramp = float(progress%100)/100;
	float timer_tri = makeTri(float(progress%90)/90);
	
	vec2 moving_dir = vec2(sin(6.283f*timer_ramp), cos(6.283f*timer_ramp));

    vec3 fg_color 		= texture(texture0, fgCoord(fragTexCoord - moving_dir*0.1f)).rgb;
	vec3 bg_color 		= texture(texture0, bgCoord(fragTexCoord)).rgb;

	vec3 prev_color = mix(
				texture(texture0, outOldCoord(fragTexCoord-moving_dir*0.01f)).rgb,
				texture(texture0, outPrevCoord(fragTexCoord+moving_dir*0.05f)).rgb,
				0.5f
	);
	
    vec3 out_color = rgb2hsv(fg_color);
	vec3 out2_color = rgb2hsv(bg_color);
    out_color.x = out2_color.x - out_color.x;
	out_color.y = max(out_color.y, out2_color.y);
    out_color = hsv2rgb(out_color);
    
    out_color = mix(out_color, prev_color, min(0.8f,exp2(0.5f-5.0f*timer_tri)));

    finalColor = vec4(out_color, 1.0);
}
