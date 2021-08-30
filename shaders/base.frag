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

float expSim(in float a, in float b, in float specificity) {
    return exp(-specificity*abs(a-b));
}

vec2 fourQuadNormalise(in vec2 v) {
	float rad = atan(v.y, v.x);
	return vec2(cos(rad), sin(rad));
}

void main()
{
	float timer_ramp = float(progress%100)/100;
	float timer_tri = makeTri(float(progress%120)/60);
	float timer_tri_fast = makeTri(float(progress%20)/10);
	
    vec3 fg_color = texture(texture0, fgCoord(fragTexCoord)).rgb;
	vec2 tex_coord_flip = edgeMirror(window_size - fragTexCoord);
	float bg_color = texture(texture0, bgCoord(tex_coord_flip + vec2(timer_tri_fast*0.01, timer_tri*0.001))).b;
	float bg_prev_color = texture(texture0, bgPrevCoord(tex_coord_flip)).r;
	float bg_blacks = smoothstep(0.3, 0.8, bg_color+bg_prev_color);
	float bg_black = smoothstep(0.45, 0.55, bg_blacks);

	vec3 prev_color = mix(
		texture(texture0, outOldCoord(fragTexCoord)).rgb,
		texture(texture0, outPrevCoord(fragTexCoord)).rgb,
		0.5f
	);
	
    vec3 fg_hsv = rgb2hsv(fg_color);
    float sky = expSim(fg_hsv.x, 0.5+timer_tri/8.0, 10.0);
	sky = sky * (2*expSim(fg_hsv.y, 0.2+timer_tri/4.0, 3.0) - 1);
	sky = sky * (0.333 + 0.666*smoothstep(0.0, 0.3, fragTexCoord.y));
	sky = clamp(sky,0.0,1.0);
	sky = smoothstep(0.2,0.5,sky);

    vec3 out_color = mix(fg_color, prev_color*bg_blacks, sky);

    //finalColor = vec4(vec3(sky), 1.0);
    finalColor = vec4(out_color, 1.0);
}
