import * as d3 from "d3";
import { select as $, selectAll as $$ } from "d3";

var svg, plot, h, w, x, y, colors, horses;

var line = d3.line()
	.x(function(d, i) { return x(i); })
	.y(function(d) { return y(d); });

export var data = {};

export var state = {
	margin_top: 100,
	margin_right: 120,
	margin_bottom: 50,
	margin_left: 50,
	start_circle_r: 2,
	end_circle_r: 10,
	label_font_size: 12,
	rank_font_size: 14,
	palette: "schemeCategory20",
	shade: true,
	shade_opacity: 0.1,
	shade_width: 20,
	line_opacity: 1,
	line_width: 2,
	timeslice: 0,
	selected_horse: null,
	button_text: "Replay",
	target_position: undefined,
	duration: 200,
};
var current_position = 0;

export function update() {
	svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
	plot.attr("transform", "translate(" + state.margin_left + "," + state.margin_top + ")");

	w = window.innerWidth - state.margin_left - state.margin_right;
	h = window.innerHeight - state.margin_top - state.margin_bottom;

	x = d3.scaleLinear().range([0, w]).domain(d3.extent(data.horserace, function(d, i) { return i; }));
	y = d3.scaleLinear().range([h, 0]).domain([
		d3.max(data.horserace, function(d) { return d3.max(d.horses, function(v) { return +v; }); }),
		d3.min(data.horserace, function(d) { return d3.min(d.horses, function(v) { return +v; }); })
	]);

	$("#clip rect")
		.attr("transform", "translate(0,-" + state.shade_width/2 + ")")
		.attr("height", h + state.shade_width)
		.attr("width", x(current_position));

	$("#replay").text(state.button_text);

	colors = d3[state.palette];
	function color(d, i) { return colors[i % colors.length]; }

	var xAxis = d3.axisTop(x).tickFormat(function(d) { return data.horserace[d].timeslice });
	$(".x.axis").call(xAxis)
		.selectAll("text")
		.style("text-anchor","start")
		.attr("dx", "2.3em")
		.attr("dy", "-0.9em")
		.attr("transform", "rotate(-45)");

	var yAxis = d3.axisLeft(y).tickSize(-w).tickPadding(10);
	$(".y.axis").call(yAxis);

	horses = [];
	for (var i = 0; i < data.horserace.column_names.horses.length; i++) {
		var header = data.horserace.column_names.horses[i];
		var ranks = [];
		for (var j = 0; j < data.horserace.length; j++) {
			var timeslice = data.horserace[j].horses;
			ranks.push(timeslice[i]);
		}
		horses.push({ name: header, ranks: ranks });
	}

	var lines = plot.selectAll(".line-group").data(horses);
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
		.attr("d", function(d) { return line(d.ranks); })
		.attr("stroke", color)
		.attr("opacity", state.line_opacity)
		.attr("stroke-width", state.line_width);
	lines_update
		.select(".shade")
		.attr("d", function(d) { return line(d.ranks); })
		.attr("stroke", color)
		.attr("display", state.shade ? "block" : "none")
		.attr("opacity", state.shade_opacity)
		.attr("stroke-width", state.shade_width);
	lines.exit().remove();

	var start_circles = plot.selectAll(".start-circle").data(horses);
	var start_circles_enter = start_circles.enter().append("circle").attr("class", "horse start-circle")
		.attr("cx", 0)
		.attr("r", 5)
		.attr("fill", color);
	start_circles.merge(start_circles_enter)
		.attr("cy", function(d) { return y(d.ranks[0]); })
		.select(".start.circle")
		.attr("r", state.start_circle_r);
	start_circles.exit().remove();

	var labels = plot.selectAll(".labels-group").data(horses);
	var labels_enter = labels.enter().append("g").attr("class", "horse labels-group")
		.on("mouseover", mouseover).on("mouseout", mouseout)
		.attr("transform", function(d) { return "translate(" + x(current_position) + "," + y(d.ranks[Math.floor(current_position)]) + ")"; });
	labels_enter.append("circle").attr("class", "end circle");
	labels_enter.append("text").attr("class", "rank-number")
		.attr("alignment-baseline", "central").attr("fill", "white")
		.attr("text-anchor", "middle");
	labels_enter.append("text").attr("class", "name").attr("alignment-baseline", "central");
	var labels_update = labels.merge(labels_enter).attr("fill", color);
	labels_update.select(".end.circle").attr("r", state.end_circle_r).attr("fill", color);
	labels_update.select(".rank-number")
		.attr("font-size", state.rank_font_size)
		.text(function(d) { return d.ranks[Math.floor(current_position)]; });
	labels_update.select(".name").attr("font-size", state.label_font_size)
		.attr("x", state.end_circle_r + 2)
		.text(function(d) { return d.name; });
	labels.exit().remove();

	if (current_position == getTargetPosition()) tieBreak();
}

function mouseover(d, i) {
	if (state.selected_horse) return;
	var hovered = d;
	$$(".horse").attr("opacity", function(d) {
		return hovered.name == d.name ? 1 : 0.05;
	});
}

function mouseout(d, i) {
	if (state.selected_horse) return;
	$$(".horse").attr("opacity", 1);
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

function createDom() {
	var body = $("body");
	svg = body.append("svg").on("click", clearHighlighting);
	plot = svg.append("g").attr("id", "plot");
	plot.append("clipPath").attr("id", "clip").append("rect").attr("width", 0);
	plot.append("g").attr("class", "x axis");
	plot.append("g").attr("class", "y axis");
	body.append("div").attr("id", "replay").text(state.button_text).on("click", play);
}

export function draw() {
	createDom();
	update();
	play();

	window.onresize = function() {
		$("body svg").remove();
		createDom();
		update();
	};
}

function tieBreak() {
	var seen_rank = {};
	var target_position = getTargetPosition();
	$$(".labels-group").each(function(d) {
		var rank = d.ranks[target_position];
		if (rank in seen_rank) {
			seen_rank[rank].setAttribute("transform", "translate(" + x(current_position) + "," + (y(rank) - state.end_circle_r) + ")");
			this.setAttribute("transform", "translate(" + x(current_position) + "," + (y(rank) + state.end_circle_r) + ")");
		}
		seen_rank[rank] = this;
	});
}

function getRank(d, p) {
	var floor_p = Math.floor(p);
	if (p == floor_p) return d.ranks[p];
	var frac_p = p - floor_p;
	return (1 - frac_p) * d.ranks[floor_p] + frac_p * d.ranks[floor_p + 1];
}

function getTargetPosition() {
	if (typeof state.target_position === "undefined") {
		return data.horserace.length - 1;
	}
	return state.target_position;
}

var prev_timestamp,
    af = null;
function frame(t) {
	var target_position = getTargetPosition();

	if (!prev_timestamp) {
		prev_timestamp = t;
		af = requestAnimationFrame(frame);
		return;
	}
	current_position += (t - prev_timestamp) / state.duration;
	if (current_position > target_position) current_position = target_position;

	$("#clip rect").attr("width", x(current_position));
	$$(".labels-group")
		.attr("transform", function(d) {
			return "translate(" + x(current_position) + "," + y(getRank(d, current_position)) + ")";
		})
		.select(".rank-number").text(function(d) { return d.ranks[Math.floor(current_position)]; });

	if (current_position < target_position) {
		af = requestAnimationFrame(frame);
		prev_timestamp = t;
	}
	else {
		af = null;
		tieBreak();
	}
}

function play() {
	current_position = 0;
	prev_timestamp = null;
	if (af) cancelAnimationFrame(af);
	af = requestAnimationFrame(frame);
}
