// script.js

// keep track of which scene we’re on
let currentScene = 0;
const scenes = [scene0, scene1, scene2];

// grab the SVG and set up margins
const svg = d3.select("#chart");
const { width: svgW, height: svgH } = svg.node().getBoundingClientRect();
const margin = { top: 40, right: 20, bottom: 40, left: 60 };
const innerWidth  = svgW - margin.left - margin.right;
const innerHeight = svgH - margin.top  - margin.bottom;
const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// x and y scales
const x = d3.scaleLinear().range([0, innerWidth]);
const y = d3.scaleLinear().range([innerHeight, 0]);

// load the OWID energy CSV
d3.csv("https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv", d3.autoType)
  .then(data => {
    // 1) filter to country === "World"
    const worldRaw = data.filter(d => d.country === "World");
    console.log("Raw World rows:", worldRaw.length);

    // 2) remove rows without a finite primary_energy_consumption
    const world = worldRaw.filter(d => Number.isFinite(d.primary_energy_consumption));
    console.log("Filtered World rows (valid primary data):", world.length);

    if (world.length === 0) {
      console.error("No valid world rows—cannot plot");
      return;
    }

    // 3) compute derived fields
    world.forEach(d => {
      d.primary         = d.primary_energy_consumption;
      d.renewablesShare = d.renewables_consumption / d.primary * 100;
      d.fossil          = (d.coal_consumption  || 0)
                        + (d.oil_consumption   || 0)
                        + (d.gas_consumption   || 0);
      d.zeroCarbon      = (d.nuclear_consumption || 0)
                        + (d.renewables_consumption || 0);
    });

    // 4) set domains based on filtered world
    x.domain(d3.extent(world, d => d.year));
    y.domain([0, d3.max(world, d => d.primary)]);

    // 5) expose globally for scene functions
    window.world = world;

    // 6) draw the first scene
    render();
  })
  .catch(err => console.error("Data load failed:", err));

// render dispatcher
function render() {
  const titles = [
    "Total Primary Energy Consumption (PJ)",
    "Renewables Share of Total Energy (%)",
    "Fossil vs. Zero-Carbon Energy"
  ];
  d3.select("#title").text(titles[currentScene]);
  d3.select("#annotation").selectAll("*").remove();
  g.selectAll("*").remove();
  scenes[currentScene]();
}

// scene 0: total primary energy line
function scene0() {
  const line = d3.line()
    .defined(d => Number.isFinite(d.primary))
    .x(d => x(d.year))
    .y(d => y(d.primary));

  g.append("path")
    .datum(world)
    .attr("fill", "none")
    .attr("stroke", "#333")
    .attr("stroke-width", 2)
    .attr("d", line);

  drawAxes();

  const last = world[world.length - 1];
  annotate(last.year, last.primary, `${last.year}: ${Math.round(last.primary)} PJ`);
}

// scene 1: renewables share line
function scene1() {
  y.domain([0,100]);
  const line = d3.line()
    .defined(d => Number.isFinite(d.renewablesShare))
    .x(d => x(d.year))
    .y(d => y(d.renewablesShare));

  g.append("path")
    .datum(world)
    .attr("fill","none")
    .attr("stroke","green")
    .attr("stroke-width",2)
    .attr("d", line);

  drawAxes();

  const cross = world.find(d => d.renewablesShare >= 10);
  annotate(cross.year, cross.renewablesShare, `~${cross.year}: 10% Renewables`);
}

// scene 2: fossil vs zero-carbon stacked area
function scene2() {
  y.domain([0, d3.max(world, d => d.fossil + d.zeroCarbon)]);
  const series = d3.stack().keys(["fossil","zeroCarbon"])(world);

  const color = d3.scaleOrdinal()
    .domain(["fossil","zeroCarbon"])
    .range(["#888","#4CAF50"]);

  const area = d3.area()
    .defined(d => Number.isFinite(d[0]) && Number.isFinite(d[1]))
    .x(d => x(d.data.year))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]));

  g.selectAll("path.area")
    .data(series)
    .join("path")
      .attr("class","area")
      .attr("fill", d => color(d.key))
      .attr("d", area);

  drawAxes();

  const mid = world[Math.floor(world.length/2)];
  annotate(mid.year, mid.fossil + mid.zeroCarbon, `${mid.year}: Zero-carbon growth`);
}

// draw x & y axes
function drawAxes() {
  g.append("g").call(d3.axisLeft(y));
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
}

// annotation helper
function annotate(year,val,label,dx=-50,dy=-50) {
  const ann=[{
    note:{ label },
    x:x(year), y:y(val),
    dx, dy,
    subject:{ radius:4 }
  }];
  d3.select("#annotation")
    .append("svg")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
    .call(d3.annotation().annotations(ann).type(d3.annotationCalloutCircle));
}

// prev/next controls
d3.select("#prev").on("click", () => {
  if (currentScene>0) currentScene--;
  render();
});
d3.select("#next").on("click", () => {
  if (currentScene<scenes.length-1) currentScene++;
  render();
});
