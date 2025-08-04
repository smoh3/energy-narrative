// PARAMETERS
let currentScene = 0;
const scenes = [scene0, scene1, scene2];

// SVG & margin setup
const svg = d3.select("#chart");
const { width: svgW, height: svgH } = svg.node().getBoundingClientRect();
const margin = { top: 40, right: 20, bottom: 40, left: 60 };
const innerWidth  = svgW - margin.left - margin.right;
const innerHeight = svgH - margin.top  - margin.bottom;
const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Scales
const x = d3.scaleLinear().range([0, innerWidth]);
const y = d3.scaleLinear().range([innerHeight, 0]);

// Load CSV
d3.csv(
  "https://nyc3.digitaloceanspaces.com/owid-public/data/energy/owid-energy-data.csv",
  d3.autoType
)
  .then(data => {
    // filter for country === "World"
    const worldRaw = data.filter(d => d.country === "World");
    console.log("Raw World rows:", worldRaw.length);

    // keep only those with a finite primary_energy_consumption
    const world = worldRaw.filter(d => Number.isFinite(d.primary_energy_consumption));
    console.log("Filtered World rows (valid primary):", world.length);
    if (!world.length) return console.error("No valid rows to plot");

    // compute derived metrics
    world.forEach(d => {
      d.primary         = d.primary_energy_consumption;
      d.renewablesShare = d.renewables_consumption / d.primary * 100;
      d.fossil          = (d.coal_consumption  || 0)
                        + (d.oil_consumption   || 0)
                        + (d.gas_consumption   || 0);
      d.zeroCarbon      = (d.nuclear_consumption  || 0)
                        + (d.renewables_consumption || 0);
    });

    // initial domains for scene0
    x.domain(d3.extent(world, d => d.year));
    y.domain([0, d3.max(world, d => d.primary)]);

    // expose globally
    window.world = world;

    // draw first scene
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

  // disable buttons at ends
  d3.select("#prev").property("disabled", currentScene === 0);
  d3.select("#next").property("disabled", currentScene === scenes.length - 1);
}

// SCENE 0: Total primary energy line + tooltip circles + static annotation
function scene0() {
  // line generator skipping NaNs
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

  // tooltip circles
  g.selectAll("circle.datapoint")
    .data(world)
    .join("circle")
      .attr("class", "datapoint")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.primary))
      .attr("r", 6)
    .append("title")
      .text(d => `${d.year}: ${Math.round(d.primary)} PJ`);

  drawAxes();

  // static annotation on the first point
  const first = world[0];
  annotate(first.year, first.primary,
           `${first.year}: ${Math.round(first.primary)} PJ`, 
           30, -30);
}

// SCENE 1: Renewables share + tooltips + existing annotation
function scene1() {
  // y-domain 0–100%
  y.domain([0, 100]);

  const line = d3.line()
    .defined(d => Number.isFinite(d.renewablesShare))
    .x(d => x(d.year))
    .y(d => y(d.renewablesShare));

  g.append("path")
    .datum(world)
    .attr("fill", "none")
    .attr("stroke", "green")
    .attr("stroke-width", 2)
    .attr("d", line);

  // tooltip circles
  g.selectAll("circle.datapoint")
    .data(world)
    .join("circle")
      .attr("class", "datapoint")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.renewablesShare))
      .attr("r", 6)
    .append("title")
      .text(d => `${d.year}: ${d.renewablesShare.toFixed(1)}%`);

  drawAxes();

  // callout at ~10%
  const cross = world.find(d => d.renewablesShare >= 10);
  annotate(cross.year, cross.renewablesShare,
           `~${cross.year}: 10% Renewables`,
           -60, -40);
}

// SCENE 2: Stacked fossil vs zero-carbon + static annotation
function scene2() {
  y.domain([0, d3.max(world, d => d.fossil + d.zeroCarbon)]);

  const series = d3.stack().keys(["fossil", "zeroCarbon"])(world);

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
  annotate(mid.year, mid.fossil + mid.zeroCarbon,
           `${mid.year}: Zero-carbon growth`,
           -60, 20);
}

// helper: draw axes
function drawAxes() {
  g.append("g").call(d3.axisLeft(y));
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
}

// helper: static callout annotation
function annotate(year, val, label, dx = -50, dy = -50) {
  const ann = [{
    note: { label },
    x: x(year),
    y: y(val),
    dx, dy,
    subject: { radius: 4 }
  }];

  d3.select("#annotation")
    .append("svg")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
    .call(d3.annotation().annotations(ann).type(d3.annotationCalloutCircle));
}

// Prev/Next wiring
d3.select("#prev").on("click", () => {
  if (currentScene > 0) currentScene--;
  render();
});
d3.select("#next").on("click", () => {
  if (currentScene < scenes.length - 1) currentScene++;
  render();
});
