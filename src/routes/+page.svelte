<script lang="ts">
	import PDFEditor from '$lib/components/PDFEditor.svelte';
</script>

<div class="app-container">
	<header>
		<h1>WebPDF Editor</h1>
	</header>
	
	<main>
		<PDFEditor />
	</main>
	
	<footer>
		<p>&copy; 2025 WebPDF Editor - Version 1.0</p>
	</footer>
</div>

<style lang="scss">
	.app-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
	}
	
	header {
		padding: 1rem;
		background-color: #1e40af;
		color: white;
		
		h1 {
			margin: 0;
			font-size: 1.5rem;
		}
	}
	
	main {
		flex: 1;
		overflow: hidden;
		display: flex;
	}
	
	footer {
		padding: 0.5rem 1rem;
		font-size: 0.75rem;
		background-color: #f1f5f9;
		color: #64748b;
		border-top: 1px solid #e2e8f0;
		text-align: center;
	}
</style>
