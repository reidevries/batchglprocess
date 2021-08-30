//#version 330 not needed as this is defined in "useful_functions.frag"

void main()
{
    vec3 fg_color = texture(texture0, windowCoord(fragTexCoord, window_fg)).rgb;
    finalColor = vec4(fg_color, 1.0);
}
