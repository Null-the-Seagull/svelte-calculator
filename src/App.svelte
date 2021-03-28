<script>
	let title = 'Svelte Calculator'

	let result_display

	function handleClick(e) {
		result_display = e.target.value
	}
</script>

<main>
	<h1>{title}</h1>
	<hr>
	<input id='inp_display' type='text' value={result_display} readonly><br>
	<table>
		<tr>
			<td>
				<button value=7 on:click={handleClick}> 7 </button>
			</td>	
			<td>
				<button value=8 on:click={handleClick}> 8 </button>
			</td>
			<td>
				<button value=9 on:click={handleClick}> 9 </button>
			</td>
		</tr>
		<tr>
			<td>
				<button value=4 on:click={handleClick}> 4 </button>
			</td>	
			<td>
				<button value=5 on:click={handleClick}> 5 </button>			
			</td>
			<td>
				<button value=6 on:click={handleClick}> 6 </button>			
			</td>
		</tr>
		<tr>
			<td>
				<button value=1 on:click={handleClick}> 1 </button>
			</td>	
			<td>
				<button value=2 on:click={handleClick}> 2 </button>
			</td>
			<td>
				<button value=3 on:click={handleClick}> 3 </button>
			</td>
		</tr>
	</table>
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}

	button {
		color: #580600;
		padding: 32px 32px;
		text-align: center;
	}
</style>