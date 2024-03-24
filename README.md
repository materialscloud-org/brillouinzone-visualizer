# Brillouin Zone visualizer

This repository contains a Javascript library to visualize the 1st brillouin zone (BZ) of crystal structures.

The primary input to the Javascript widget is a `json` file generated from a crystal structure using [seekpath](https://github.com/giovannipizzi/seekpath).

See `./seekpath_example_data` on how to generate the `json` file.

A Jupyter widget corresponding to this library is located at https://github.com/osscar-org/widget-bzvisualizer

## Development

A demo page is included for development and to demonstrate the usage of the library. Start it by

```
npm install
npm run dev
```

## Building the library

To build the local version of the code as a library that can be used in other javascript projects, use

```
npm run build
npm pack
```

This will create a `.tgz` file that can then be installed by the external application via

```
npm install /path/to/library-x.y.z.tgz
```

And the usage is similar to the demo page.

## Publishing the library

...
