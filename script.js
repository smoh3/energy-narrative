// PARAMETERS
let currentScene = 0;
const scenes = [scene0, scene1, scene2];

// SVG, margins, and group setup
const svg = d3.select("#chart");
const margin = { top: 40, right: 20, bottom: 40, left: 60 };
const width = parseInt(svg.style("width")) - margin.left - margin.right;
const height = parseInt(svg.style("height")) - margin.top - margin.bottom;
const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Scales
const x = d3.scaleLinear().range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

// Load data from OWID GitHub
d3.csv("https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv", d3.autoType)
  .then(data => {
    // Filter to world aggregate
    const world = data.filter(d => d.iso_code === "OWID_WRL");

    // Compute series values
    world.forEach(d => {
      d.primary = d.primary_energy_consumption;
      d.renewablesShare = d.renewables_consumption / d.primary * 100;
      d.fossil = d.coal_consumption + d.oil_consumption + d.gas_consumption;
      d.zeroCarbon = d.nuclear_consumption + d.renewables_consumption;
    });

    // Initial scale domains
    x.domain(d3.extent(world, d => d.year));
    y.domain([0, d3.max(world, d => d.primary)]);

    // Expose to scenes
    window.world = world;

    // Render first scene
    render();
  })
  .catch(err => console.error("Data load failed:", err));

// Render dispatcher
function render() {
  const titles = [
    "Total Primary Energy Consumption (PJ)",
    "Renewables Share of Total Energy (%)",
    "Fossil vs. Zero-Carbon Energy"
  ];
  d3.select("#title").text(titles[currentScene]);
  d3.select("#annotation").html("");
  g.selectAll("*").remove();
  scenes[currentScene]();
}

// Scene 0: Total Primary Energy
function scene0() {
  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.primary));

  g.append("path")
    .datum(world)
    .attr("fill", "none")
    .attr("stroke", "#333")
    .attr("stroke-width", 2)
    .attr("d", line);

  drawAxes(x, y);

  // Annotation: latest value
  const latest = world[world.length - 1];
  annotate(latest.year, latest.primary, `2021: ${Math.round(latest.primary)} PJ`);
}

// Scene 1: Renewables Share
function scene1() {
  y.domain([0, 100]);

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.renewablesShare));

  g.append("path")
    .datum(world)
    .attr("fill", "none")
    .attr("stroke", "green")
    .attr("stroke-width", 2)
    .attr("d", line);

  drawAxes(x, y);

  const cross = world.find(d => d.renewablesShare >= 10);
  annotate(cross.year, cross.renewablesShare, `~${cross.year}: Renewables hit 10%`);
}

// Scene 2: Fossil vs Zero-Carbon Split
function scene2() {
  y.domain([0, d3.max(world, d => d.fossil + d.zeroCarbon)]);

  const stack = d3.stack()
    .keys(["fossil", "zeroCarbon"]);

  const series = stack(world);

  const color = d3.scaleOrdinal()
    .domain(["fossil", "zeroCarbon"])
    .range(["#888", "#4CAF50"]);

  g.selectAll(".area")
    .data(series)
    .enter()
    .append("path")
      .attr("fill", d => color(d.key))
      .attr("d", d3.area()
        .x(d => x(d.data.year))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
      );

  drawAxes(x, y);

  const mid = world[Math.floor(world.length / 2)];
  annotate(mid.year, mid.fossil + mid.zeroCarbon, `${mid.year}: Zero-carbon starts growing`, -60, 20);
}

// Utility: draw axes
function drawAxes(xScale, yScale) {
  g.append("g").call(d3.axisLeft(yScale));
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
}

// Utility: annotation
function annotate(year, value, label, dx = -50, dy = -50) {
  const ann = [{
    note: { label },
    x: x(year), y: y(value),
    dx, dy,
    subject: { radius: 4 }
  }];

  d3.annotation()
    .annotations(ann)
    .type(d3.annotationCalloutCircle)
    (d3.select("#annotation")
      .append("svg")
      .attr("width", width)
      .attr("height", height));
}

// Controls
d3.select("#next").on("click", () => {
  if (currentScene < scenes.length - 1) currentScene++;
  render();
});
d3.select("#prev").on("click", () => {
  if (currentScene > 0) currentScene--;
  render();
});
