module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);
     
    grunt.initConfig({
        sass: {
            options: {
                //style: 'compressed',
                sourceMap: true
            },
            dist: {
                files: {
                    'css/style.css': '_sass/main.scss'
                }
            }
        },
        postcss: {
            options: {
                processors: [
                    require('autoprefixer')({browsers: 'last 2 versions'}), // add vendor prefixes
                    require('cssnano')() // minify the result
                ]
            },
            dist: {
                src: 'css/*.css'
            }
        },
        watch: {
            css: {
                files: '**/*.scss',
                tasks: ['sass'],
                options: {
                    livereload: true,
                },
            },
        },
    });
     
    grunt.registerTask('default', ['watch']);
    grunt.registerTask('build', ['sass', 'postcss']);

}