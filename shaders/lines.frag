//#version 330 not needed as this is in "useful_functions.frag"

void main()
{
	float timer_ramp = float(progress%100)/100;
	float timer_tri = makeTri(float(progress%120)/60);
	float timer_sin = sin(progress*3.14159/60.0);
	float timer_tri_fast = makeTri(float(progress%20)/10);
	
    vec3 fg_color = texture(texture0, windowCoord(fragTexCoord, window_fg)).rgb;
	vec3 bg_color = texture(texture0, windowCoord(fragTexCoord, window_bg)).rgb;
	vec2 tex_coord_flip = edgeMirror(window_size - fragTexCoord);

	vec3 prev_color = mix(
		texture(texture0, windowCoord(fragTexCoord, window_out_old)).rgb,
		texture(texture0, windowCoord(fragTexCoord, window_out_prev)).rgb,
		0.5f
	);
	


    vec3 sob = sobel(fragTexCoord, window_fg, 2);
	vec3 sob2 = sobel(fragTexCoord, window_bg, 2);

	vec3 lines = vec3(smoothstep(0.1, 0.12, 1+sin(sob2*timer_sin*5)));
	float up_right = exp(dot(vec2(0.707, 0.707), sob2.xy)-2.5);
	up_right = bell(sin(length(sob.xy)*6), 0.1, 0.7);
	vec3 out_color = vec3(up_right);
    finalColor = vec4(sob, 1.0);
}
