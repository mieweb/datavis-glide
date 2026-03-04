import React from 'react';
import { createRoot } from 'react-dom/client';
import { DVSource, DVGrid } from '/src/components/react.jsx';

document.addEventListener('DOMContentLoaded', function () {
	window.MIE = window.MIE || {};
	window.MIE.DEBUGGING = true;

	var columns = [
		'rowId',
		'string1',
		'country',
		'state',
		'fruit',
		'int1',
		'float1',
		'currency1',
		'date1',
		'boolean1',
	];

	var root = createRoot(document.getElementById('app'));
	root.render(
		<DVSource type="http" url="../random100.json">
			<DVGrid
				title="Test - React Grid"
				showControls
				columns={columns}
			/>
		</DVSource>
	);
});
