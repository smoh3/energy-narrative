// script.js

// PARAMETERS
let currentScene = 0;
const scenes = [scene0, scene1, scene2];

// Grab the SVG and measure its size
const svg = d3.select("#chart");
const { width: svgW, height: svgH } = svg.node().getBoundingClientRect();
const margin = { top: 40, right: 20, bottom: 40, left: 60 };
const width = svgW - margin.left - margin.right;
const height = svgH - margin.top - margin.bottom;

// Create a group for margins
const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Scales
const x = d3.scaleLinear().range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

// LOAD DATA from OWID public S3 (includes OWID_WRL) :contentReference[oaicite:0]{index=0}
d3.csv(
  "https://nyc3.digitaloceanspaces.com/owid-public/data/energy/owid-energy-data.csv",
  d3.autoType
)
  .then(data => {
    // Filter for the global aggregate
    const world = data.filter(d => d.iso_code === "OWID_WRL");
    console.log("Data loaded, world rows:", world.length);
    if (!world.length) {
      console.error("No global (OWID_WRL) rows—check the CSV URL or iso_code");
      return;
    }

    // Compute our three series
    world.forEach(d => {
      d.primary = d.primary_energy_consumption;
      d.renewablesShare = (d.renewables_consumption / d.primary) * 100;
      d.fossil = d.coal_consumption + d.oil_consumption + d.gas_consumption;
      d.zeroCarbon = d.nuclear_consumption + d.renewables_consumption;
    });

    // Set initial domains (scene 0)
    x.domain(d3.extent(world, d => d.year));
    y.domain([0, d3.max(world, d => d.primary)]);

    // Expose globally
    window.world = world;

    // First draw
    render();
  })
  .catch(err => console.error("Data load failed:", err));

// Dispatcher
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

// Scene 0: Total primary energy line
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

  drawAxes();

  // Annotate the latest point
  const last = world[world.length - 1];
  annotate(last.year, last.primary, `${last.year}: ${Math.round(last.primary)} PJ`);
}

// Scene 1: Renewables share line
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

  drawAxes();

  // Annotate when it first crosses 10%
  const cross = world.find(d => d.renewablesShare >= 10);
  annotate(cross.year, cross.renewablesShare, `~${cross.year}: 10% Renewables`);
}

// Scene 2: Stacked fossil vs zero‐carbon
function scene2() {
  y.domain([0, d3.max(world, d => d.fossil + d.zeroCarbon)]);

  const stack = d3.stack().keys(["fossil", "zeroCarbon"]);
  const series = stack(world);

  const color = d3.scaleOrdinal()
    .domain(["fossil", "zeroCarbon"])
    .range(["#888", "#4CAF50"]);

  g.selectAll("path.area")
    .data(series)
    .join("path")
      .attr("class", "area")
      .attr("fill", d => color(d.key))
      .attr("d", d3.area()
        .x(d => x(d.data.year))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
      );

  drawAxes();

  // Annotate mid‐century shift
  const mid = world[Math.floor(world.length / 2)];
  annotate(mid.year, mid.fossil + mid.zeroCarbon,
           `${mid.year}: Zero‐carbon growth`, -60, 20);
}

// Axes helper
function drawAxes() {
  g.append("g").call(d3.axisLeft(y));
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
}

// Annotation helper
function annotate(year, value, label, dx = -50, dy = -50) {
  const ann = [{
    note: { label },
    x: x(year), y: y(value),
    dx, dy,
    subject: { radius: 4 }
  }];

  d3.select("#annotation")
    .append("svg")
      .attr("width", width)
      .attr("height", height)
    .call(d3.annotation()
      .annotations(ann)
      .type(d3.annotationCalloutCircle)
    );
}

// Prev/Next buttons
d3.select("#prev").on("click", () => {
  if (currentScene > 0) currentScene--;
  render();
});
d3.select("#next").on("click", () => {
  if (currentScene < scenes.length - 1) currentScene++;
  render();
});
