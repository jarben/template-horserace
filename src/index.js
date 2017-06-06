import * as d3 from "d3";
import { select as $, selectAll as $$ } from "d3";

var svg, plot, h, w, x, y, colors, horses;

var line = d3.line()
	.x(function(d, i) { return x(i); })
	.y(function(d) { return y(d); });

export var data = {};

export var state = {
	margin_top: 20,
	margin_right: 20,
	margin_bottom: 40,
	margin_left: 40,
	start_circle_r: 2,
	end_circle_r: 14,
	label_font_size: 12,
	rank_font_size: 14,
	palette: "schemeCategory20",
	shade: true,
	shade_opacity: 0.1,
	shade_width: 20,
	line_opacity: 1,
	line_width: 2,
	duration: 300,
	timeslice: 0,
	desired_time:10,
	selected_horse: null,
	button_text: "Replay",
	flip_axis: true,
	customTicks: true,
	tickStepY: 3,
	showImage:true
};
var current_time;
var selected_line;

var prev_window_width, prev_window_height, changed_size = false;

export function update() {
	changed_size = prev_window_width != window.innerWidth || prev_window_height != window.innerHeight;

	$("#replay").text(state.button_text);

	if(state.palette){
		colors = d3[state.palette];
	}
	
	if( changed_size ) { resizeVizContainer() };
	
	if( changed_size || !data.horserace.processed ) { updateScale(); }
	if( changed_size || !data.horserace.processed ) { updateAxes(); }

	updateViz();

	$("#clip rect").attr("width", x(current_time));

	animateViz();
	prev_window_width = window.innerWidth;
	prev_window_height = window.innerHeight;

	data.horserace.processed = true;
}

function resizeVizContainer(){
	svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
	plot.attr("transform", "translate(" + state.margin_left + "," + state.margin_top + ")");
	w = window.innerWidth - state.margin_left - state.margin_right;
	h = window.innerHeight - state.margin_top - state.margin_bottom;
	$("#clip rect").transition().duration(0).attr("height", h + state.shade_width).attr("transform", "translate(0,-" + state.shade_width/2 + ")");
}

function updateScale(){
	x = d3.scaleLinear().range([0, w]).domain(d3.extent(data.horserace[0].weeks, function(d, i) { return i; }));
	y = d3.scaleLinear().range([h, 0]).domain([
		d3.max(data.horserace, function(d) { return d3.max(d.weeks, function(v) { return +v; }); }),
		d3.min(data.horserace, function(d) { return d3.min(d.weeks, function(v) { return +v; }); })
	]);
	if(state.flip_axis){
		y.range([0,h])
	}
}

function updateAxes(){
	var ticks = data.horserace[0].weeks.length;
	var xAxis = d3.axisBottom(x).tickSize(-h).ticks(ticks).tickFormat(function(d) { return d + 1 });
	
	$(".x.axis").call(xAxis)
		.attr('transform','translate(0,' + h + ')')

	var yAxis = d3.axisLeft(y).tickSize(-w);
	
	if(state.customTicks){
		var maxPoints = d3.max(data.horserace, function(d) { return d3.max(d.weeks, function(v) { return +v; }); });
		if(state.tickStepY){
			yAxis.tickValues(d3.range(0, maxPoints, state.tickStepY))
		}

		if(state.tickStepX){
			yAxis.tickValues(d3.range(0, ticks, state.tickStepX))
		}
		
	}
	$(".y.axis").call(yAxis);

	$$(".x.axis .tick").on('click',function(e){
		state.desired_time = e;
		update();
	})
}

function updateViz(){
	function color(d, i) { 
		if(state.palette){
			return colors[i % colors.length]; 
		}else{
			return "#333"
		}
		
	}

	var lines = plot.selectAll(".line-group").data(data.horserace);
	var lines_enter = lines.enter().append("g").attr("class", "horse line-group")
		.on("mouseover", mouseover).on("mouseout", mouseout)
		.on("click", function(d, i) {
			d3.event.stopPropagation();
			if (!state.selected_horse) state.selected_horse = i;
			else state.selected_horse = null;
			update();
		});
	lines_enter.append("path").attr("class", "shade")
		.attr("clip-path", "url(#clip)")
		.attr("fill", "none");
	lines_enter.append("path").attr("class", "line")
		.attr("clip-path", "url(#clip)")
		.attr("fill", "none");
	
	var lines_update = lines.merge(lines_enter)
		.attr("opacity", function(d, i) {
			return i == state.selected_horse || !state.selected_horse ? 1 : 0;
		});
	lines_update
		.select(".line")
		.attr("d", function(d) { return line(d.weeks); })
		.attr("stroke", color)
		.attr("opacity", state.line_opacity)
		.attr("stroke-width", state.line_width);
	lines_update
		.select(".shade")
		.attr("d", function(d) { return line(d.weeks); })
		.attr("stroke", color)
		.attr("display", state.shade ? "block" : "none")
		.attr("opacity", state.shade_opacity)
		.attr("stroke-width", state.shade_width);
	
	lines.exit().remove();



	var start_circles = plot.selectAll(".start-circle").data(data.horserace);
	var start_circles_enter = start_circles.enter().append("circle").attr("class", "horse start-circle")
		.attr("cx", 0)
		.attr("r", 5)
		.attr("fill", color);
	start_circles.merge(start_circles_enter)
		.attr("cy", function(d) { return y(d.weeks[0]); })
		.select(".start.circle")
		.attr("r", state.start_circle_r);
	start_circles.exit().remove();
	
	var labels = plot.selectAll(".labels-group").data(data.horserace);
	var labels_enter = labels.enter().append("g").attr("class", "horse labels-group")
		.on("mouseover", mouseover).on("mouseout", mouseout)
		.attr("transform", function(d) { return "translate(" + x(current_time) + "," + y(d.weeks[current_time]) + ")"; });
	
	if(state.showImage) {
		labels_enter.append("circle")
			.attr('r',state.end_circle_r)
			.attr('fill','#fff')
			.attr('stroke',"#eee")

		labels_enter.append("image")
			.attr('xlink:href',function(d){
				return Flourish.static_prefix + '/team_logos/' + d.icon
			})
			.attr('height',state.end_circle_r * 2 - 8)
			.attr('width',state.end_circle_r * 2 - 8)
			.attr('y',-(state.end_circle_r * 2 - 8) / 2)
			.attr('x',-(state.end_circle_r * 2 - 8) / 2)

		labels.select("circle")
			.attr('r',state.end_circle_r)
			.attr('fill','#fff')
			.attr('stroke',"#eee")

		labels.select("image")
			.attr('xlink:href',function(d){
				return Flourish.static_prefix + '/team_logos/' + d.icon
			})
			.attr('height',state.end_circle_r * 2 - 8)
			.attr('width',state.end_circle_r * 2 - 8)
			.attr('y',-(state.end_circle_r * 2 - 8) / 2)
			.attr('x',-(state.end_circle_r * 2 - 8) / 2)
	} else {
		labels_enter.append("circle").attr("class", "end circle");

		if(state.showNumbber){
			labels_enter.append("text").attr("class", "rank-number")
				.attr("alignment-baseline", "central").attr("fill", "white")
				.attr("text-anchor", "middle");
			
			labels_enter.append("text").attr("class", "name").attr("alignment-baseline", "central");
		}
	}

	var labels_update = labels.merge(labels_enter).attr("fill", color);
	labels_update.select(".end.circle").attr("r", state.end_circle_r).attr("fill", color);
	labels_update.select(".rank-number").attr("font-size", state.rank_font_size);
	labels_update.select(".name").attr("font-size", state.label_font_size)
		.attr("x", state.end_circle_r + 2)
		.text(function(d) { return d.name; });
	
	labels.exit().remove();
}

function mouseover(d, i) {
	if (state.selected_horse) return;
	var hovered = d;
	$$(".horse").attr("opacity", function(d) {
		return hovered.name == d.name ? 1 : 0.05;
	});
}

function mouseout(d, i) {
	// if (state.selected_horse) return;
	// $$(".horse").attr("opacity", 1);
}

function clickline(d, i) {
	if (state.selected_horse) clearHighlighting();
	else state.selected_horse = i;
	update();
	highlightHorse(state.selected_horsei);
}

function clearHighlighting() {
	state.selected_horse = null;
	update();
}

export function draw() {
	state.desired_time = current_time = data.horserace.length - 1;
	var body = $("body");
	svg = body.append("svg");
	plot = svg.append("g").attr("id", "plot");
	plot.append("clipPath").attr("id", "clip").append("rect").attr("width", 0);
	plot.append("g").attr("class", "x axis");
	plot.append("g").attr("class", "y axis");
	
	svg.on('mouseleave',function(d){
		$$(".horse").attr("opacity", 1);
	})

	window.onresize = update;
	update();
}


var moveInterval;
function animateViz(){
	clearInterval(moveInterval);
	moveInterval = setInterval(function(){
		if(current_time < state.desired_time){
			current_time++;
		}else if(current_time > state.desired_time){
			current_time--;
		}else if(current_time == state.desired_time){
			clearInterval(moveInterval)
		}
		updateMask();
	},state.duration)
}

function updateMask(){
	$("#clip rect").transition().ease(d3.easeLinear).duration(state.duration)
		.attr("width", x(current_time));

	$$(".labels-group").transition().ease(d3.easeLinear).duration(state.duration)
		.attr("transform", function(d) { return "translate(" + x(current_time) + "," + y(d.weeks[current_time]) + ")"; })
		.select(".rank-number").text(function(d) { return d.weeks[current_time]; });
}







// To do
// Styling
// Rank - Value
// Image support
