import { globby } from 'globby';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const paths = (await globby(['./src/**/*.html'])).map(path =>
	path.replace('./src/', '')
);

const input = {
	main: resolve(__dirname, '../index.html'),
};

let count = 0;
paths.forEach(p => {
	input[count++] = resolve(__dirname, p);
});

export default defineConfig({
	base: './',
	server: {
		port: 4000
	},
	build: {
		rollupOptions: {
			input,
		},
	},
});
