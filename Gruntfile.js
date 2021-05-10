module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        meta: {
            banner: '// Materials Cloud bands structure widget v<%= pkg.version %>\n' +
                '// https://www.materialscloud.org\n' +
                '// Contributors: <%= pkg.author %>\n' +
                '// (c) <%= grunt.template.today("yyyy") %>, Released under the MIT License\n'
        },

        clean: {
            dist: {
                files: [{
                    dot: true,
                    src: [
                        "dist/{,*/}*",
                        'lib/brillouinzone-visualizer.min.js']
                }]
            }
        },

        concat: {
            options: {
                separator: ';',
                nonull: true
            },
            dist: {
                src: [
                    'lib/OrbitControls.js',
                    'lib/Projector.js',
                    'lib/SVGRenderer.js',
                    'lib/BZVisualizer.js'],
                dest: 'dist/brillouinzone-visualizer.js'
            },
            html: {
                src: [
                    'es6/three.min.js',
                    'es6/OrbitControls.js',
                    'es6/Projector.js',
                    'es6/SVGRenderer.js',
                    'es6/BZVisualizer.js'],
                dest: 'dist/brillouinzone-visualizer-es6.js'
            },

        },

        // minifies JS files
        uglify: {
            options: {
                mangle: true,
                banner: '<%= meta.banner %>'
            },
            dist: {
                files: {
                    'lib/brillouinzone-visualizer.min.js': ['dist/brillouinzone-visualizer.js'],
                    'es6/brillouinzone-visualizer-es6.min.js': ['dist/brillouinzone-visualizer-es6.js'],
                }
            }
        },

        babel: {
            compile: {
                options: {
                    sourceMap: true,
                    presets: ['@babel/preset-env', 'babel-preset-es2015', 'minify']
                },
                dist: {
                    files: {
                        'dist/brillouinzone-visualizer.min.js': ['dist/brillouinzone-visualizer.js']
                    }
                }
            }
        },

        jshint: {
            options: {
                browser: true,
                sub: true,
                globals: {
                    jQuery: true
                }
            },
            all: {
                src: ['js/BZVisualizer.js']
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    //grunt.loadNpmTasks('grunt-babel');

    grunt.registerTask('build', [
        "clean",
        'jshint',
        'concat',
        'uglify'
    ]);

};
