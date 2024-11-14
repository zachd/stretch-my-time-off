import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		prerender: {
			entries: [
				'*', // This will prerender all static routes
				// Add specific dynamic routes here, e.g., '/blog/post-1', '/blog/post-2'
			]
		},
		paths: {
			assets: 'https://stretchmytimeoff.com', // Set your fully qualified domain here
		}
	}
};

export default config;
