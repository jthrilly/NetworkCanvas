/* global Konva, window, $, note, ConvexHullGrahamScan, Image */
/* exported Sociogram */
/*jshint bitwise: false*/

module.exports = function sociogramNarrative() {
	'use strict';
	// Global variables
	var stage = {}, circleLayer = {}, backgroundLayer = {}, edgeLayer = {}, nodeLayer = {}, wedgeLayer = {}, hullLayer = {}, hullShapes = {}, uiLayer = {}, sociogramNarrative = {};
	var moduleEvents = [], selectedNodes = [], hulls = [], animations = [];
	sociogramNarrative.selectedNode = null;
	var viewingOptions = false;
	var newNodeCircleTween, log, backgroundRect;
	var nodesWithoutPositions = 0, currentPrompt = 0;
	var newNodeCircleVisible = false, hullsShown = false, taskComprehended = false;

	// Colours
	var colors = {
		blue: '#0174DF',
		tomato: '#FF6347',
		teal: '#008080',
		hullpurple: '#9a208e',
		freesia: '#ffd600',
		hullgreen: '#6ac14c',
		cayenne: '#c40000',
		placidblue: '#83b5dd',
		violettulip: '#9B90C8',
		hemlock: '#9eccb3',
		paloma: '#aab1b0',
		sand: '#ceb48d',
		dazzlingblue: '#006bb6',
		edge: '#dd393a',
		selected: '#ffbf00',
	};

	var hullColors = ['#01a6c7','#1ECD97', '#B16EFF','#FA920D','#e85657','Gold','Pink','Saddlebrown','Teal','Silver'];

	// Default settings
	var settings = {
		network: window.netCanvas.Modules.session.getPrimaryNetwork(),
		targetEl: 'kineticCanvas',
		// consecutive single tap - edge mode
		// drag - layout mode
		// double tap - select mode
		// long press - community mode
		modes:['Position'], //edge - create edges, position - lay out, select - node attributes
	    panels: ['details'], // Mode - switch between modes, Details - long press shows node details
		options: {
			defaultNodeSize: 33,
			defaultNodeColor: 'white',
			defaultNodeStrokeWidth: 4,
			defaultLabelColor: 'black',
			defaultEdgeColor: colors.edge,
			concentricCircleColor: '#ffffff',
			concentricCircleNumber: 4,
			concentricCircleSkew: false,
			showMe: false
		},
		dataOrigin: {
			'Position': {
				type: 'node',
				variable: 'coords'
			},
			'Community' : {
				type: 'ego',
				name: 'Groups',
				egoVariable: 'contexts',
				variable: 'contexts'
			}
		},
		prompts: [],
	    criteria: { // criteria for being shown on this screen
	        includeEgo: false,
	        query: {
	        }
	    },
		edges: [
			{
				types:['social'],
				keyLabel: 'Spend time together',
				stroke: '#01a6c7'
			}
		]
	};

	// Private functions

	// Adjusts the size of text so that it will always fit inside a given shape.
	function padText(text, container, amount){
		while (( text.getTextWidth() * 1.001 ) < container.width() - ( amount * 2 ) && ( text.getTextHeight() * 1.001 ) < container.height() - ( amount * 2 )) {
			text.fontSize( text.fontSize() * 1.001 );
		}

		text.y( ( (text.getTextHeight() /2) ) * -1);
		text.x( ( (text.getTextWidth() / 2) *- 1 ) );
	}

	function toPointFromObject(array) {
		var newArray = [];
		for (var i = 0; i<array.length; i++) {
			newArray.push(array[i].x);
			newArray.push(array[i].y);
		}

		return newArray;
	}

	function addNodeHandler(e) {
		sociogramNarrative.addNode(e.detail);
	}

	sociogramNarrative.changeData = function() {
		sociogramNarrative.resetNodeState();
		sociogramNarrative.updateState();
	};

	sociogramNarrative.init = function (userSettings) {

		note.info('Sociogram initialising.');

		$.extend(true, settings,userSettings);
		// Add the title and heading
		$('<div class="sociogram-title"></div>').insertBefore('#'+settings.targetEl );

		// Initialise the konva stage
		sociogramNarrative.initKinetic();

		// Draw ui compoennts
		sociogramNarrative.drawUIComponents(function() {

			// Show hulls checkbox
			if (settings.modes.indexOf('Community') !== -1) {
				$('#'+settings.targetEl).append('<input class="show-contexts-checkbox" type="checkbox" name="context-checkbox-show" id="context-checkbox-show"> <label for="context-checkbox-show">Contexts shown</label>');
			}

			// Set node states
			sociogramNarrative.addNodeData();

			// Add the evevent listeners
			sociogramNarrative.bindEvents();

			// Update initial states of all nodes and edges;
			sociogramNarrative.updateState();

			// Update key
			sociogramNarrative.updateKeyPanel();

		});
	};

	function toggleChevron(e) {
		$(e.target)
			.prev('.panel-heading')
			.find('i.indicator')
			.toggleClass('glyphicon-chevron-down glyphicon-chevron-up');
	}

	function toggleKeyOptions() {
		$('.key-panel-initial').toggleClass('show');

		if (viewingOptions) {
			sociogramNarrative.updateKeyPanel();
			viewingOptions = false;
		} else {
			viewingOptions = true;
			// Generate options
			sociogramNarrative.updateOptionsPanel();
		}
	}

	function presetSelectHandler() {
		var name = this.value;

		// event
		// var log = new window.CustomEvent('log', {'detail':{'eventType': 'changePreset', 'eventObject':this.Value}});
		// window.dispatchEvent(log);
		// var unsavedChanges = new window.Event('unsavedChanges')
		// window.dispatchEvent(unsavedChanges);

		$.each(settings.presets, function(presetIndex, presetValue) {
			if (presetValue.name === name) {
				settings.edges = presetValue.edges;
				settings.selected = presetValue.selected;
				settings.size = presetValue.size;
			}
		});

		sociogramNarrative.updateState();
		sociogramNarrative.updateKeyPanel();
	}

	sociogramNarrative.bindEvents = function() {
		// Events
		var event = [
			{
				event: 'changeStageStart',
				handler: sociogramNarrative.destroy,
				targetEl:  window
			},
			{
				event: 'nodeAdded',
				handler: addNodeHandler,
				targetEl:  window
			},
			{
				event: 'edgeAdded',
				handler: sociogramNarrative.updateState,
				targetEl:  window
			},
			{
				event: 'nodeRemoved',
				handler: sociogramNarrative.removeNode,
				targetEl:  window
			},
			{
				event: 'edgeRemoved',
				handler: sociogramNarrative.removeEdge,
				targetEl:  window
			},
			{
				event: 'change',
				handler: sociogramNarrative.toggleHulls,
				subTarget: '#context-checkbox-show',
				targetEl:  window.document
			},
			{
				event: 'click',
				handler: toggleKeyOptions,
				targetEl: window.document,
				subTarget: '.btn.change'
			},
			{
				event: 'change',
				targetEl: window.document,
				subTarget: '#key-panel-preset-select',
				handler: presetSelectHandler
			},
			{
				event: 'click',
				targetEl: '.reset-state-button',
				handler: sociogramNarrative.resetButton
			}
		];
		window.tools.Events.register(moduleEvents, event);

		$('#accordion1').on('hidden.bs.collapse', toggleChevron);
		$('#accordion1').on('shown.bs.collapse', toggleChevron);
		$('#accordion2').on('hidden.bs.collapse', toggleChevron);
		$('#accordion2').on('shown.bs.collapse', toggleChevron);

	};

	sociogramNarrative.destroy = function() {
		$.each(animations, function(index, value) {
			value.stop();
		});
		note.info('sociogramNarrative.destroy();');
		stage.destroy();
		window.tools.Events.unbind(moduleEvents);

		$('#accordion1').off('hidden.bs.collapse', toggleChevron);
		$('#accordion1').off('shown.bs.collapse', toggleChevron);
		$('#accordion2').off('hidden.bs.collapse', toggleChevron);
		$('#accordion2').off('shown.bs.collapse', toggleChevron);
	};

	sociogramNarrative.addNodeData = function() {
		note.debug('sociogramNarrative.addNodeData()');
		var criteriaNodes;

		// get nodes according to criteria query
		// filter out ego if required
			criteriaNodes = settings.network.getNodes(settings.criteria.query, function (results) {
				var filteredResults = [];
				$.each(results, function(index,value) {
					if (value.type_t0 !== 'Ego') {
						filteredResults.push(value);
					}
				});

				return filteredResults;
			});

		for (var j = 0; j < criteriaNodes.length; j++) {

      var dyadEdge = settings.network.getEdges({type:'Dyad', from: settings.network.getEgo().id, to: criteriaNodes[j].id})[0];

			sociogramNarrative.addNode(dyadEdge);
		}

		// Layout Mode
		var layoutNodes = sociogramNarrative.getKineticNodes();
		$.each(layoutNodes, function(index,node) {
			node.setPosition(node.attrs.coords);
		});

		// Community
		var communityNodes;

		// community data is coming from ego
		if (typeof settings.network.getEgo().contexts === 'undefined') {
			var communityProperties = {};
			communityProperties.contexts= [];
			netCanvas.Modules.session.getPrimaryNetwork().updateNode(netCanvas.Modules.session.getPrimaryNetwork().getEgo().id, communityProperties);
		}

		var egoHulls = netCanvas.Modules.session.getPrimaryNetwork().getEgo().contexts;
		$.each(egoHulls, function(hullIndex, hullValue) {
			sociogramNarrative.addHull(hullValue);
		});

		communityNodes = sociogramNarrative.getKineticNodes();
		$.each(communityNodes, function(index,node) {
			$.each(node.attrs.contexts, function (hullIndex, hullValue) {
				// Difference from node mode is we check if the node hull has been defined by ego too
				// if (egoHulls.indexOf(hullValue) !== -1) {
					sociogramNarrative.addPointToHull(node, hullValue);
				// }

			});
		});

	};

	sociogramNarrative.toggleHulls = function(e) {
		note.info('Sociogram: toggleHulls()');

		if ((e && e.target.checked) || hullsShown === false) {
			$('label[for="context-checkbox-show"]').html('Contexts shown');
			new Konva.Tween({
				node: hullLayer,
				duration: 0.5,
				opacity: 1
			}).play();
			hullsShown = true;
		} else {
			$('label[for="context-checkbox-show"]').html('Contexts hidden');

			new Konva.Tween({
				node: hullLayer,
				duration: 0.5,
				opacity: 0
			}).play();

			hullsShown = false;
		}

		// event
		// var log = new window.CustomEvent('log', {'detail':{'eventType': 'toggleHulls', 'eventObject':{hullsShow: hullsShown}}});
		// window.dispatchEvent(log);
		// var unsavedChanges = new window.Event('unsavedChanges')
		// window.dispatchEvent(unsavedChanges);

		$('label[for="context-checkbox-show"]').addClass('show');
		setTimeout(function() {
			$('label[for="context-checkbox-show"]').removeClass('show');
		}, 2000);
		hullLayer.draw();
	};

	sociogramNarrative.resetNodeState = function() {
		// event
		// var log = new window.CustomEvent('log', {'detail':{'eventType': 'resetNodes', 'eventObject':{}}});
		// window.dispatchEvent(log);
		// var unsavedChanges = new window.Event('unsavedChanges')
		// window.dispatchEvent(unsavedChanges);

		// Reset select
		var kineticNodes = sociogramNarrative.getKineticNodes();
		$.each(kineticNodes, function(nodeIndex, nodeValue) {
			nodeValue.children[1].stroke(settings.options.defaultNodeColor);
			// Reset sizes
			nodeValue.children[1].setAttr('radius', settings.options.defaultNodeSize);
			nodeValue.children[1].fill('white');
			nodeValue.children[2].fill('black');
		});

		nodeLayer.batchDraw();

		// Reset edges
		edgeLayer.removeChildren();
		edgeLayer.batchDraw();
	};

	sociogramNarrative.drawUIComponents = function (callback) {

			// New node button
			$('#'+settings.targetEl).append('<div class="reset-state-button text-center"><span class="fa fa-2x fa-refresh"></span></div>');

			// Key panel
			$('#'+settings.targetEl).append('<div class="key-panel on"></div>');

			$('.key-panel').append(`
			<div class="key-panel-initial" id="accordion1" role="tablist" aria-multiselectable="true">
					<div class="defaultOnly">
						<select class="selectpicker" title="Preset..." id="key-panel-preset-select" data-width="100%"></select>
					</div>
					<div class="">
						<div class="panel-heading" role="tab" id="headingTwo">
							<h5>
								<a class="collapsed" role="button" data-toggle="collapse" data-parent="#accordion1" href="#collapseTwo" aria-expanded="true" aria-controls="collapseTwo">
								Highlighted
								<i class="indicator glyphicon glyphicon-chevron-down pull-right"></i></a>
							</h5>
						</div>
						<div id="collapseTwo" class="nodes-panel panel-collapse collapse in" role="tabpanel" aria-labelledby="headingTwo">

						</div>
					</div>
					<div class="">
						<div class="panel-heading" role="tab" id="headingOne">
							<h5>
								<a role="button" data-toggle="collapse" data-parent="#accordion1" href="#collapseOne" aria-expanded="true" aria-controls="collapseOne">
								Links
								<i class="indicator glyphicon glyphicon-chevron-down pull-right"></i></a>
							</h5>
						</div>
						<div id="collapseOne" class="links-panel panel-collapse collapse in" role="tabpanel" aria-labelledby="headingOne">

						</div>
					</div>
					<div class="settingsOnly">
						<div class="panel-heading" role="tab" id="options-headingThree">
							<h5>
								<a class="collapsed" role="button" data-toggle="collapse" data-parent="#accordion2" href="#options-collapseThree" aria-expanded="false" aria-controls="options-collapseThree">
								Size
								<i class="indicator glyphicon glyphicon-chevron-up pull-right"></i></a>
							</h5>
						</div>
						<div id="options-collapseThree" class="size-panel panel-collapse collapse" role="tabpanel" aria-labelledby="options-headingThree">
						</div>
					</div>
			</div>
			`);


			// Handle preset select
			$.each(settings.presets, function(presetIndex, presetValue) {
				$('#key-panel-preset-select').append('<option value="'+presetValue.name+'">'+presetValue.name+'</option>');
			});

			$('select').selectpicker();

			// Draw all UI components
			var previousSkew = 0;
			var circleFills, circleLines;
			var currentColor = settings.options.concentricCircleColor;
			var totalHeight = window.innerHeight-(settings.options.defaultNodeSize); // Our sociogram area is the window height minus twice the node radius (for spacing)
			var currentOpacity = 0.1;

			//draw concentric circles
			for(var i = 0; i < settings.options.concentricCircleNumber; i++) {
				var ratio = (1-(i/settings.options.concentricCircleNumber));
				var skew = i > 0 ? (ratio * 5) * (totalHeight/50) : 0;
				var currentRadius = totalHeight/2 * ratio;
				currentRadius = settings.options.concentricCircleSkew? currentRadius + skew + previousSkew : currentRadius;
				if (i === settings.options.concentricCircleNumber-1 && settings.options.concentricCircleColor > 1) {
					currentRadius += 50;
				}
				previousSkew = skew;
				circleLines = new Konva.Circle({
					x: window.innerWidth / 2,
					y: window.innerHeight / 2,
					radius: currentRadius,
					hitGraphEnabled: false,
					stroke: 'white',
					strokeWidth: 1.5,
					opacity: 0
				});

				circleFills = new Konva.Circle({
					x: window.innerWidth / 2,
					y: (window.innerHeight / 2),
					radius: currentRadius,
					fill: currentColor,
					hitGraphEnabled: false,
					opacity: currentOpacity,
					strokeWidth: 0,
				});

				// currentColor = tinycolor.darken(currentColor, amount = 15).toHexString();
				currentOpacity = currentOpacity+((0.3-currentOpacity)/settings.options.concentricCircleNumber);
				circleLayer.add(circleFills);
				circleLayer.add(circleLines);

			}

			// Node container
			var newNodeCircle = new Konva.Circle({
				radius: 60,
				transformsEnabled: 'none',
				hitGraphEnabled: false,
				stroke: 'white',
				strokeWidth: 7
			});

			// add the shape to the layer

			var newNodeCircleGroup = new Konva.Group({
			 x: 145,
			 opacity:0,
			 y: window.innerHeight / 2,
			});

			newNodeCircleGroup.add(newNodeCircle);
			circleLayer.add(newNodeCircleGroup);

			newNodeCircleTween = new Konva.Tween({
			 node: newNodeCircleGroup,
			 opacity: 1,
			 duration: 1
			});

			// Draw 'me'
			if (settings.options.showMe === true) {

				var meCircle = new Konva.Circle({
					radius: 50,
					x: window.innerWidth / 2,
					y: window.innerHeight / 2,
					hitGraphEnabled: false,
					fill: '#D0D2DC',
				});

				var meText = new Konva.Text({
					x: window.innerWidth / 2,
					y: window.innerHeight / 2,
					text: 'me',
					align: 'center',
					offset: {x:28,y:22},
					fontSize: 40,
					fontFamily: 'Helvetica',
					fill: 'black'
				 });
				circleLayer.add(meCircle);
				circleLayer.add(meText);
			}

			circleLayer.draw();

			note.debug('User interface initialised.');

			if (callback) {
				callback();
			}
	};

	sociogramNarrative.updateOptionsPanel = function() {
		var markup = '';
		var panel;

		// Links panel
		panel = $('.links-panel');
		panel.children().remove();

		// create array of all types of edge;
		var types = {
			'negative': {
				label: 'Have had conflict'
			},
			'social': {
				label: 'Spend time together'
			},
			'professional': {
				label: 'Have worked together'
			}
		};
		$.each(types, function(typeIndex, typeValue) {
			markup = `<div>
				<input type="checkbox" name="${typeIndex}" id="${typeIndex}" value="${typeIndex}">
			      <label class="checkbox" for="${typeIndex}">
			        ${typeValue.label}
			      </label>
			  </div>`;
			panel.append(markup);
		});

		// Node panel
		panel = $('.nodes-panel');
		panel.children().remove();
		var nodeVariables = {
			'advice_given': {
				label: 'Gave you advice'
			},
			'advice_sought': {
				label: 'Sought their advice'
			},
			'advice_refused': {
				label: 'Refused to give advice'
			},
			'advice_negative': {
				label: 'Gave you bad advice'
			},
			'support_emotional': {
				label: 'Supported you emotionally'
			},
			'support_practical': {
				label: 'Supported you practically'
			},
			'support_failed': {
				label: 'Failed to support you'
			},
			'info_given': {
				label: 'Gave you information'
			},
			'info_refused': {
				label: 'Refused you information'
			},
			'technologically_mediated': {
				label: 'Know through the internet'
			}
		};
		$.each(nodeVariables, function(typeIndex, typeValue) {
			markup = `<div>
				<input type="checkbox" name="${typeIndex}" id="${typeIndex}" value="${typeIndex}">
				<label class="checkbox" for="${typeIndex}">
				  ${typeValue.label}
				</label>
			</div>`;
			panel.append(markup);
		});

		// Size panel
		panel = $('.size-panel');
		panel.children().remove();
		var sizeVariables = {
			'ord_helpfulness': {
				label: 'Helpfulness'
			},
			'ord_stress': {
				label: 'Cause stress or anxiety'
			},
			'ord_disempowering': {
				label: 'Is controlling'
			},
			'ord_negative': {
				label: 'Have negative interactions with'
			}
		};
		$.each(sizeVariables, function(sizeIndex, sizeValue) {
			markup = `<div>
				<input type="checkbox" name="${sizeIndex}" id="${sizeIndex}" value="${sizeIndex}">
				<label class="checkbox" for="${sizeIndex}">
				  ${sizeValue.label}
				</label>
			</div>`;
			panel.append(markup);
		});

	};

	sociogramNarrative.updateKeyPanel = function() {
		var markup = '';
		var panel;

		// Links panel
		panel = $('.links-panel');
		panel.children().remove();
		if (typeof settings.edges !== 'undefined' && typeof settings.edges === 'object') {
			$.each(settings.edges, function(edgeIndex, edgeValue) {
				markup = `<div class="key-panel-row row">
					<div class="col-md-3 key-panel-icon edge-key-icon">
						<svg class="panel-icon edge-icon" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 300 300" style="enable-background:new 0 0 300 300;" xml:space="preserve">
							<g>
								<line style="stroke:${edgeValue.stroke};fill:none;stroke-width:25;stroke-miterlimit:10;" x1="48.25" y1="252.815" x2="255.998" y2="48.25"/>
								<line style="stroke:${edgeValue.stroke};fill:none;stroke-width:25;stroke-miterlimit:10;" x1="48.25" y1="48.25" x2="255.998" y2="48.25"/>
								<circle style="fill:#F1F2F2;" cx="48.25" cy="251.75" r="47.25"/>
								<circle style="fill:#F1F2F2;" cx="251.75" cy="48.25" r="47.25"/>
								<circle style="fill:#F1F2F2;" cx="48.25" cy="48.25" r="47.25"/>
							</g>
						</svg>
					</div>
					<div class="col-md-9 key-panel-text edge-key-text">
						<span class="edge-key-label">${edgeValue.keyLabel}</span>
					</div>
				</div>`;

				panel.append(markup);
			});

		}


		// Node panel
		panel = $('.nodes-panel');
		panel.children().remove();
		if (typeof settings.selected !== 'undefined' && typeof settings.selected === 'object') {
			$.each(settings.selected, function(selectedIndex, selectedValue) {
				markup = `<div class="key-panel-row row">
						<div class="col-md-3 key-panel-icon node-key-icon">
							<svg class="panel-icon node-icon" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
								 viewBox="0 0 300 300" style="enable-background:new 0 0 300 300;" xml:space="preserve">
							<circle style="stroke:${selectedValue.color};fill:#FFFFFF;stroke-width:40;stroke-miterlimit:10;" cx="150" cy="150" r="108.333"/>
							</svg>
						</div>
						<div class="col-md-9 key-panel-text node-key-text">
							<span class="node-key-label">${selectedValue.label}</span>
						</div>
					</div>`;

				panel.append(markup);
			});

		}

	};

	sociogramNarrative.updateState = function() {
		/**
		* Updates visible attributes based on current prompt task
		*/

		sociogramNarrative.resetNodeState();
		var nodes = settings.network.getNodes();
		var edges = settings.network.getEdges();

		// Edges
		if (typeof settings.edges !== 'undefined' && typeof settings.edges === 'object') {

			// Iterate over settings.edge
			$.each(settings.edges, function(index, value) {
				// Now iterate over all edges
				$.each(edges, function(index, edge) {
					// For each edge, check if it is of the type indicated in settings.edges
					if (value.types.indexOf(edge.type) !== -1) {
						var options = {
							stroke: value.stroke
						};
						sociogramNarrative.addEdge(edge, options);
					}

				});
			});

		}

		edgeLayer.draw();

		// Selected nodes
		if (typeof settings.selected !== 'undefined' && typeof settings.selected === 'object') {

			// Iterate over select settings
			$.each(settings.selected, function(index, value) {
				// Iterate over nodes
				$.each(nodes, function(index, node) {
					// If any of value.variables = 1, select node
					var found = false, found2 = false;

					var dyadEdge = settings.network.getEdges({type:'Dyad', to: node.id})[0];
					if (dyadEdge) { //dont run on ego

						$.each(value.variables, function(valueIndex, valueValue) {
							if (typeof dyadEdge[valueValue] !== 'undefined') {

								found = dyadEdge[valueValue];
								found2 = valueValue;

							}
						});
					}
					// this node is selected
					if (found) {
						var colors2 = ['#ffffff', '#80D2E3', '#40BCD5', '#01A6C7'];
						var colors = ['#ffffff', '#C6F2E5', '#8EE6CB', '#56D9B1', '#1ECD97'];

						var swatch = found2 === 'education_t0'  ? colors : colors2;
						var sociogramNode = sociogramNarrative.getNodeByID(node.id);
						sociogramNode.children[1].stroke(swatch[found]);
						sociogramNode.children[1].fill(swatch[found]);
						var fillColor = found >= 2 ? 'white' : 'black';
						sociogramNode.children[2].fill(fillColor);
					}

				});
			});

			nodeLayer.draw();
		}

	};

	sociogramNarrative.getSelectedNodes = function() {
		return selectedNodes;
	};

	sociogramNarrative.resetButton = function() {
		$.each(animations, function(index, value) {
			value.stop();
		});

		var kineticNodes = sociogramNarrative.getKineticNodes();

		$.each(kineticNodes, function(index, value) {
			value.children[1].setAttr('shadowColor', 'black');
			value.children[1].setAttr('shadowBlur', 2);
		});

		$.each(annotations, function(index, value) {
			value.tween.finish();
			value.tween.destroy();
		});

		backgroundLayer.draw();
	};

	sociogramNarrative.addHull = function(label) {
		note.info('sociogramNarrative.addHull ['+label+']');
		// ignore groups that already exist
		label = label ? label : 'New Context '+$('li[data-hull]').length;
		if (typeof hullShapes[label] === 'undefined') {
			var thisHull = {};
			thisHull.label = label;
	        thisHull.hull = new ConvexHullGrahamScan();

			var color = hullColors[hulls.length];

	        var hullShape = new Konva.Line({
	          points: [window.outerWidth/2, window.outerHeight/2],
	          fill: color,
	          opacity:0.5,
	          stroke: color,
	          lineJoin: 'round',
	          lineCap: 'round',
			  transformsEnabled: 'position',
			  hitGraphEnabled: false,
	          tension : 0.1,
	          strokeWidth: 80,
	          closed : true
	        });
			hullShapes[label] = hullShape;
			hulls.push(thisHull.label);
	        hullLayer.add(hullShapes[label]);
			hullLayer.opacity(0);
	        hullLayer.draw();

			// If the data origin is ego, also add the new hull to ego
			if (settings.dataOrigin.Community.type === 'ego') {
				// If ego doesn't have the variable set, create it

				var properties;
				if (typeof netCanvas.Modules.session.getPrimaryNetwork().getEgo()[settings.dataOrigin.Community.egoVariable] === 'undefined') {
					properties = {};
					properties[settings.dataOrigin.Community.egoVariable] = [];
					netCanvas.Modules.session.getPrimaryNetwork().updateNode(netCanvas.Modules.session.getPrimaryNetwork().getEgo().id, properties);
				}

				// get existing data
				var egoContexts = netCanvas.Modules.session.getPrimaryNetwork().getEgo()[settings.dataOrigin.Community.egoVariable];
				if (egoContexts.indexOf(thisHull.label) === -1) {
					// Update ego
					egoContexts.push(thisHull.label);
					window.netCanvas.Modules.session.saveData();
				}

			}

			// Contexts panel
			var panel = $('.contexts-panel');
			var markup = `<div class="key-panel-row row">
				<div class="col-md-3 key-panel-icon context-key-icon">
				<svg class="panel-icon context-icon camp" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 300 300" style="enable-background:new 0 0 300 300;" xml:space="preserve">
				<g>
						<path style="fill:${color}" d="M76.495,285.593c-63.25,0-89.125-44.817-57.5-99.593L92.5,58.686c31.625-54.776,83.375-54.776,115,0L281.005,186c31.625,54.776,5.75,99.593-57.5,99.593H76.495z"/>
						<circle style="fill:#FFFFFF;" cx="150" cy="83.675" r="44.761"/>
						<circle style="fill:#FFFFFF;" cx="69.357" cy="224.153" r="43.677"/>
						<circle style="fill:#FFFFFF;" cx="230.991" cy="224.153" r="43.677"/>
				</g>
				</svg>
				</div>
				<div class="col-md-9 key-panel-text context-key-text">
					<span class="context-key-label">${label}</span>
				</div>
			</div>`;

			panel.append(markup);

		}

    };

	sociogramNarrative.hullExists = function(hullLabel) {
		var found = false;
		if (hulls.indexOf(hullLabel) !== -1) {
			found = true;
		}
		return found;
	};

    sociogramNarrative.addPointToHull = function(point, hullLabel) {
		// check if hull is already present
		note.info('sociogramNarrative.addPointToHull()');
		var properties;
		// if a hull with hullLabel doesnt exist, create one
		if (!sociogramNarrative.hullExists(hullLabel)) {
			note.warn('sociogramNarrative.addPointToHull(): the hull label "'+hullLabel+'" didn\'t exist, so a new hull was created.');
			sociogramNarrative.addHull(hullLabel);
		}

		// If the point doesn't have the destination attribute, create it
		if (point.attrs.contexts === 'undefined') {
			note.warn('Node did not have the data destinateion community attribute. A blank array was created.');
			properties = {};
			properties.contexts = [];
			netCanvas.Modules.session.getPrimaryNetwork().updateNode(point.attrs.id, properties);
		}
		// Only store if the node doesn't already have the hull present
		if (point.attrs.contexts.indexOf(hullLabel) === -1) {
			// Find the node we need to store the hull value in, and update it.

			// Create a dummy object so we can use the variable name set in settings.dataDestination
			properties = {};
			properties.contexts = point.attrs.contexts.concat([hullLabel]);
			point.attrs.contexts = point.attrs.contexts.concat([hullLabel]);

			// Update the node with the object
			settings.network.updateNode(point.attrs.id, properties, function() {
				note.debug('Network node updated', 1);
			});
		}

        // redraw all hulls begins here
        var pointHulls = point.attrs.contexts;

		// For each hull of the current point
        for (var i = 0; i < pointHulls.length; i++) {

			// Create an empty hull
            var newHull = new ConvexHullGrahamScan();

			// For each node
            for (var j = 0; j < nodeLayer.children.length; j++) {
				var thisChildHulls = nodeLayer.children[j].attrs.contexts;

				// Test if the current points current hull is in the current node's hull list

				if (thisChildHulls.indexOf(pointHulls[i]) !== -1) {
					// It is, so get the position of this node.
                    var coords = nodeLayer.children[j].getPosition();

					// Add it to the new hull

                    newHull.addPoint(coords.x, coords.y);
                }
            }

			// At the end of this loop we should have a newHull with points for all nodes

			// We need this check because on load all hull shapes might not be defined yet.
			var hullPoints = newHull.getHull();
			if (hullPoints.length === 1 && typeof hullPoints[0] === 'undefined') {
				hullPoints = [];
			}

			if (typeof hullShapes[pointHulls[i]] !== 'undefined') {
				var tween = new Konva.Tween({
					node: hullShapes[pointHulls[i]],
					points: toPointFromObject(hullPoints),
					duration: 0.5,
					onFinish: function(){
						tween.destroy();
					}
				}).play();

			}

			hullLayer.batchDraw();
            nodeLayer.draw();

        }

    };

	sociogramNarrative.redrawHulls = function() {
		for (var i = 0; i < hullShapes.length; i++) {
			var newHull = new ConvexHullGrahamScan();

			for (var j = 0; j < nodeLayer.children.length; j++) {
				var thisChildHulls = nodeLayer.children[j].attrs.contexts;
				if (thisChildHulls.indexOf(hullShapes[i]) !== -1) {
					var coords = nodeLayer.children[j].getPosition();
					newHull.addPoint(coords.x, coords.y);
				}
			}

			hullShapes[i].setPoints(toPointFromObject(newHull.getHull()));
			hullLayer.batchDraw();

		}

	};

	sociogramNarrative.getHullShapes = function() {
		return hullShapes;
	};

	sociogramNarrative.addNode = function(options) {

		note.info('Sociogram is creating a node.');
		note.debug(options);
		// Placeholder for getting the number of nodes we have.
		var nodeShape;

		var nodeID = 0;
		while (settings.network.getNode(nodeID) !== false) {
			nodeID++;
		}

		var dragStatus = false;
		if (settings.modes.indexOf('Position') !== -1 || settings.modes.indexOf('Edge') !== -1) {
			dragStatus = true;
		}

		// Try to guess at a label if one isn't provided.
		// Is there a better way of doing this?
		if (typeof options.label === 'undefined' && typeof options.nname_t0 !== 'undefined') { // for RADAR use nickname
			options.label = options.nname_t0;
		} else if (typeof options.label === 'undefined' && typeof options.name !== 'undefined'){
			options.label = options.name;
		}

		var nodeOptions = {
			id: nodeID,
			coords: [],
			positioned: false,
			label: 'Undefined',
			type: 'Person',
			transformsEnabled: 'position',
			size: settings.options.defaultNodeSize,
			color: settings.options.defaultNodeColor,
			strokeWidth: settings.options.defaultNodeStrokeWidth,
			stroke: settings.options.defaultNodeColor,
			draggable: dragStatus,
			dragDistance: 20
		};

		nodeOptions.contexts = [];
		window.tools.extend(nodeOptions, options);

		nodeOptions.id = parseInt(nodeOptions.id, 10);
		nodeOptions.x = nodeOptions.coords[0] ? nodeOptions.coords[0] : false;
		nodeOptions.y = nodeOptions.coords[1] ? nodeOptions.coords[1] : false;

		var nodeGroup = new Konva.Group(nodeOptions);

		var selectCircle = new Konva.Circle({
			radius: nodeOptions.size+(nodeOptions.strokeWidth*1.5),
			fill:settings.options.defaultEdgeColor,
			transformsEnabled: 'position',
			opacity:0
		});

		nodeShape = new Konva.Circle({
			radius: nodeOptions.size,
			fill:nodeOptions.color,
			transformsEnabled: 'position',
			strokeWidth: nodeOptions.strokeWidth,
			stroke: nodeOptions.stroke,
			shadowColor: 'black',
			shadowBlur: 2,
			shadowOffset: {x : 0, y : 0},
			shadowOpacity: 1
		});

		// var label = nodeOptions.label.wrap(8,3);
		var nodeLabel = new Konva.Text({
			text: nodeOptions.label,
			fontSize: 13,
			fontFamily: 'Lato',
			transformsEnabled: 'position',
			fill: settings.options.defaultLabelColor,
			align: 'center',
			fontStyle:500
		});

		padText(nodeLabel,nodeShape,8);

		note.debug('Putting node '+nodeOptions.label+' at coordinates x:'+nodeOptions.coords[0]+', y:'+nodeOptions.coords[1]);

		nodeGroup.add(selectCircle);
		nodeGroup.add(nodeShape);
		nodeGroup.add(nodeLabel);

		nodeLayer.add(nodeGroup);

		setTimeout(function() {
			nodeLayer.draw();
		}, 0);

		if (!options.coords || nodeOptions.coords.length === 0) {
			nodesWithoutPositions++;
			if (!newNodeCircleVisible) {
				newNodeCircleTween.play();
				newNodeCircleVisible = true;
			}
			nodeGroup.position({
				x: 0,
				y:$(window).height()/2
			});
			new Konva.Tween({
				node: nodeGroup,
				x: 145,
				y: $(window).height()/2,
				duration:0.7,
				easing: Konva.Easings.EaseOut
			}).play();
			// settings.network.setProperties(settings.network.getNode(nodeOptions.id),{coords:[$(window).width()-150, $(window).height()-150]});
		} else {

		}
		// Node event handlers
		nodeGroup.on('dragstart', function() {
			if (taskComprehended === false) {
				var eventProperties = {
					stage: window.netCanvas.Modules.session.currentStage(),
					timestamp: new Date()
				};
				log = new window.CustomEvent('log', {'detail':{'eventType': 'taskComprehended', 'eventObject':eventProperties}});
				window.dispatchEvent(log);
				taskComprehended = true;
			}


			note.debug('dragstart');

			// Add the current position to the node attributes, so we know where it came from when we stop dragging.
			this.attrs.oldx = this.attrs.x;
			this.attrs.oldy = this.attrs.y;
			this.moveToTop();
			nodeLayer.draw();
		});

		nodeGroup.on('dragmove', function() {
			if (taskComprehended === false) {
				var eventProperties = {
					stage: window.netCanvas.Modules.session.currentStage(),
					timestamp: new Date()
				};
				log = new window.CustomEvent('log', {'detail':{'eventType': 'taskComprehended', 'eventObject':eventProperties}});
				window.dispatchEvent(log);
				taskComprehended = true;
			}

			note.debug('Dragmove');
			var dragNode = nodeOptions.id;
			$.each(edgeLayer.children, function(index, value) {
				if (sociogramNarrative.getNodeByID(value.attrs.from).attrs.id === dragNode || sociogramNarrative.getNodeByID(value.attrs.to).attrs.id === dragNode) {
					var points = [sociogramNarrative.getNodeByID(value.attrs.from).getX(), sociogramNarrative.getNodeByID(value.attrs.from).getY(), sociogramNarrative.getNodeByID(value.attrs.to).getX(), sociogramNarrative.getNodeByID(value.attrs.to).getY()];
					value.attrs.points = points;

				}
			});
			edgeLayer.draw();

		});


		nodeGroup.on('dragend', function() {
			note.debug('dragend');

			// set the context
			var from = {};
			var to = {};

			// Fetch old position from properties populated by dragstart event.
			from.x = this.attrs.oldx;
			from.y = this.attrs.oldy;

			to.x = this.attrs.x;
			to.y = this.attrs.y;

			// Add them to an event object for the logger.
			var eventObject = {
				nodeTarget: this.attrs.id,
				from: from,
				to: to,
			};

			var currentNode = this;

			// Log the movement and save the graph state.
			log = new window.CustomEvent('log', {'detail':{'eventType': 'nodeMove', 'eventObject':eventObject}});
			window.dispatchEvent(log);

			window.network.setProperties(window.network.getEdge(currentNode.attrs.id), {coords: [currentNode.attrs.x,currentNode.attrs.y]});

			// remove the attributes, just incase.
			delete this.attrs.oldx;
			delete this.attrs.oldy;

		});

		nodeGroup.on('touchstart mousedown', function() {
		});

		nodeGroup.on('longPress', function() {

		});

		nodeGroup.on('touchend mouseup', function() {

		});

		nodeGroup.on('dbltap dblclick', function() {

			selectedNodes = [];

			// if (taskComprehended === false) {
			// 	var eventProperties = {
			// 		stage: window.netCanvas.Modules.session.currentStage(),
			// 		timestamp: new Date()
			// 	};
			// 	log = new window.CustomEvent('log', {'detail':{'eventType': 'taskComprehended', 'eventObject':eventProperties}});
			// 	window.dispatchEvent(log);
			// 	taskComprehended = true;
			// }
			// log = new window.CustomEvent('log', {'detail':{'eventType': 'nodeClick', 'eventObject':this.attrs.id}});
			// window.dispatchEvent(log);

			var currentNode = this;

			// if select mode enabled
			if (typeof settings.prompts[currentPrompt] !== 'undefined' && typeof settings.prompts[currentPrompt].showSelected === 'object') {

				// flip variable

				// Get current variable value
				var properties = {};
				var currentValue = settings.network.getNode(currentNode.attrs.id)[settings.prompts[currentPrompt].showSelected.variable];
				// flip
				if (currentValue != settings.prompts[currentPrompt].showSelected.value || typeof currentValue === 'undefined') {
					properties[settings.prompts[currentPrompt].showSelected.variable] = settings.prompts[currentPrompt].showSelected.value;
					currentNode.children[1].stroke(colors.selected);
				} else {
					// remove static variables, if present
					var node = netCanvas.Modules.session.getPrimaryNetwork().getNode(currentNode.attrs.id);
					node[settings.prompts[currentPrompt].showSelected.variable] = 0;
					currentNode.children[1].stroke(settings.options.defaultNodeColor);
				}

				settings.network.updateNode(currentNode.attrs.id, properties);

			}
			this.moveToTop();
			nodeLayer.draw();
		});

		nodeGroup.on('tap click', function() {
			/**
			* Tap (or click when using a mouse) events on a node trigger one of two actions:
			*
			* (1) If a hull is currently selected, tapping a node will add it to the selected hull. Any other events
			* (for example edge creation) will be ignored.
			*
			* (2) If edge creation mode is enabled and there are no selected hulls, tapping a node will mark it as being selected for potential linking.
			* If the node is the first to be selected, nothing more will happen. If it is the second, an edge will be
			* created according to the edge destination settings.
			*/

			var currentNode = this; // Store the context

			// event
			// var log = new window.CustomEvent('log', {'detail':{'eventType': 'nodeTap', 'eventObject':currentNode}});
			// window.dispatchEvent(log);
			// var unsavedChanges = new window.Event('unsavedChanges');
			// window.dispatchEvent(unsavedChanges);

			// var tween = new Konva.Tween({
			// 	node: currentNode
			// }).play();

			currentNode.children[1].shadowColor('#FA920D');
			var animation = new Konva.Animation(function(frame) {
				var blur = ((Math.sin(frame.time/200)+1)/2)*60;
				currentNode.children[1].setAttr('shadowBlur', blur);
				nodeLayer.batchDraw();
			});

			animations.push(animation);

			animation.start();
		});

		return nodeGroup;
	};

	// Edge manipulation functions

	sociogramNarrative.addEdge = function(properties, options) {
		note.info('sogioram.addEdge()');


		// This doesn't *usually* get called directly. Rather, it responds to an event fired by the network module.

		var egoID = settings.network.getEgo().id;

		if(typeof properties.detail !== 'undefined' && typeof properties.detail.from !== 'undefined' && properties.detail.from !== egoID) {
			// We have been called by an event
			properties = properties.detail;
		} else if (typeof properties.from !== 'undefined' && typeof properties.to !== 'undefined' && properties.from !== egoID) {
			// We have been called by another sociogram method
			properties = properties;
		} else {
			return false;
		}

		// the below won't work because we are storing the coords in an edge now...
		note.debug('Sociogram is adding an edge.');
		var toObject = sociogramNarrative.getNodeByID(properties.to);
	 	var fromObject = sociogramNarrative.getNodeByID(properties.from);
		var points = [fromObject.attrs.coords[0], fromObject.attrs.coords[1], toObject.attrs.coords[0], toObject.attrs.coords[1]];

		var edgeOptions = {
			// dashArray: [10, 10, 00, 10],
			strokeWidth: 6,
			transformsEnabled: 'position',
			hitGraphEnabled: false,
			opacity:1,
			// fill: '#ff0000',
			// closed: false,
			// width:100,
			stroke: settings.options.defaultEdgeColor,
			// opacity: 0.8,
			points: points,
			shadowColor: 'black',
			shadowBlur: 0.3,
			shadowOffset: {x : 0, y : 0},
			shadowOpacity: 1
		}

		// Handle options parameter to allow overriding default values
		if (options) {

			$.extend(edgeOptions, options);

		}

		var edge = new Konva.Line(edgeOptions);

		edge.setAttrs({
			from: properties.from,
			to: properties.to
		});

		edgeLayer.add(edge);

		setTimeout(function() {
			edgeLayer.draw();
		},0);
		nodeLayer.draw();
		note.trace('Created Edge between '+fromObject.attrs.label+' and '+toObject.attrs.label);

		return true;

	};

	sociogramNarrative.removeEdge = function(properties) {

		note.debug('sociogramNarrative.removeEdge() called.');
		if (!properties) {
			note.error('No properties passed to sociogramNarrative.removeEdge()!');
		}

		// Test if we are being called by an event, or directly
		if (typeof properties.detail !== 'undefined' && typeof properties.detail.from !== 'undefined' && properties.detail.from !== settings.network.getEgo().id) {
			properties = properties.detail;
		}

		var toObject = properties.to;
	 	var fromObject = properties.from;

		// This function is failing because two nodes are matching below
		var found = false;
		$.each(sociogramNarrative.getKineticEdges(), function(index, value) {
			if (value !== undefined) {
				if (value.attrs.from === fromObject && value.attrs.to === toObject || value.attrs.from === toObject && value.attrs.to === fromObject ) {
					found = true;
					edgeLayer.children[index].remove();
					edgeLayer.draw();
				}
			}

		});

		if (!found) {
			note.error('sociogramNarrative.removeEdge() failed! Couldn\'t find the specified edge.');
		} else {
			return true;
		}

	};

	sociogramNarrative.removeNode = function() {
	};

	// Misc functions

	sociogramNarrative.clearGraph = function() {
		edgeLayer.removeChildren();
		edgeLayer.clear();
		nodeLayer.removeChildren();
		nodeLayer.clear();

	};

	sociogramNarrative.getStage = function() {
		return stage;
	};

	// Main initialisation functions
	// a flag we use to see if we're dragging the mouse
        // a reference to the line we are currently drawing

		var annotations = [];
		var currentAnnotation;

		function Annotation() {

			var annotation = {
				points: [],
				isMouseDown: false
			};

			annotation.onMouseDown = function() {

				annotations.push(annotation);
				currentAnnotation = annotation;

				annotation.isMouseDown = true;
				var position = stage.getPointerPosition();
				annotation.points.push(position.x,position.y);
				annotation.line = new Konva.Line({
					points: annotation.points,
					stroke: 'red',
					strokeWidth: 5,
					lineCap: 'round',
					lineJoin: 'round'
				});
				backgroundLayer.add(annotation.line);
			};

			annotation.onMouseUp = function() {

				currentAnnotation = null;
				annotation.isMouseDown=false;
				annotation.tween = new Konva.Tween({
					node: annotation.line,
					opacity: 0,
					duration: 15,
					onFinish: function(){
					}
				}).play();
			};

			annotation.onMouseMove = function() {

				if(!annotation.isMouseDown){return;}

				var position = stage.getPointerPosition();
				annotation.points.push(position.x,position.y);
				annotation.line.setPoints(annotation.points);
				backgroundLayer.batchDraw();
			};

			annotation.init = function() {
				// make sure we have cancelled all other annotations
				$.each(annotations, function(index, value) {
					value.onMouseUp();
				});
			};

			annotation.init();

			return annotation;
		}



		function killAnnotation(target) {
			// event
			// var log = new window.CustomEvent('log', {'detail':{'eventType': 'annotation', 'eventObject':target.points}});
			// window.dispatchEvent(log);
			var unsavedChanges = new window.Event('unsavedChanges');
			window.dispatchEvent(unsavedChanges);

			stage.off('mouseup touchend', function(){killAnnotation(target);});
			stage.off('mousemove touchmove', function(){drawAnnotation(target);});
			target.onMouseUp();


		}

		function drawAnnotation(target) {
			target.onMouseMove();
		}

		function newAnnotation(e) {
			$(':focus').blur();
			if (e.target === backgroundRect) {

				// setTimeout(function() {
					var blah = new Annotation();
					blah.onMouseDown();


					stage.on('mouseup touchend', function(){killAnnotation(blah);});
					stage.on('mousemove touchmove', function(){drawAnnotation(blah);});
				// }, 100);
			}
		}

	sociogramNarrative.initKinetic = function () {
		Konva.pixelRatio=2;

		// Initialise KineticJS stage
		stage = new Konva.Stage({
			container: settings.targetEl,
			width: window.innerWidth,
			height: window.innerHeight
		});

		circleLayer = new Konva.Layer();
		hullLayer = new Konva.FastLayer();
		wedgeLayer = new Konva.FastLayer();
		nodeLayer = new Konva.Layer();
		edgeLayer = new Konva.FastLayer();

		/**
		* This hack allows us to detect clicks that happen outside of nodes, hulls, or edges.
		* We create a transparent rectangle on a special background layer which sits between the UI layer and the interaction layers.
		* We then listen to click events on this shape.
 		*/
		backgroundLayer = new Konva.Layer();
		backgroundRect = new Konva.Rect({
	        x: 0,
	        y: 0,
	        width: stage.width(),
	        height: stage.height(),
			fill: 'transparent'
	      });
		backgroundLayer.add(backgroundRect);

		stage.on('mousedown touchstart', function(e){newAnnotation(e);});

		stage.add(circleLayer);
		stage.add(hullLayer);
		stage.add(edgeLayer);
		stage.add(backgroundLayer);
		stage.add(wedgeLayer);
		stage.add(nodeLayer);

		note.debug('Konva stage initialised.');

	};

	sociogramNarrative.showDetailsPanel = function() {
		$('.details-panel').addClass('show');
	};

	sociogramNarrative.hideDetailsPanel = function() {
		$('.details-panel').removeClass('show');
	};

	sociogramNarrative.generateHull = function(points) {

        var newHull = new ConvexHullGrahamScan();

        for (var i = 0; i < points.length; i++) {
            var coords = points[i].getPosition();
            newHull.addPoint(coords.x, coords.y);
        }

		return toPointFromObject(newHull.getHull());


	};

	sociogramNarrative.getModuleEvents = function() {
		return moduleEvents;
	};

	// Get & set functions

	sociogramNarrative.getKineticNodes = function() {
		return nodeLayer.children;
	};

	sociogramNarrative.getKineticEdges = function() {
		return edgeLayer.children;
	};

	sociogramNarrative.getEdgeLayer = function() {
		return edgeLayer;
	};

	sociogramNarrative.getNodeLayer = function() {
		return nodeLayer;
	};

	sociogramNarrative.getBackgroundLayer = function() {
		return backgroundLayer;
	};

	sociogramNarrative.getUILayer = function() {
		return uiLayer;
	};

	sociogramNarrative.getHullLayer = function() {
			return hullLayer;
	};

	sociogramNarrative.getNodeByID = function(id) {
		var node = {},
		nodes = sociogramNarrative.getKineticNodes();

		$.each(nodes, function(index, value) {

			if (value.attrs.to === id) {
				node = value;
			}
		});

		return node;
	};

	sociogramNarrative.getNodeColorByType = function(type) {
		var returnVal = null;
		$.each(settings.nodeTypes, function(index, value) {
			if (value.name === type) {returnVal = value.color;}
		});

		if (returnVal) {
			return returnVal;
		} else {
			return false;
		}
	};

	return sociogramNarrative;

};
