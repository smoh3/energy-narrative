// script.js

// PARAMETERS
let currentScene = 0;
const scenes = [scene0, scene1, scene2];

// SVG & margin setup
const svg = d3.select("#chart");
const { width: svgW, height: svgH } = svg.node().getBoundingClientRect();
const margin = { top: 40, right: 20, bottom: 40, left: 60 };
const width = svgW - margin.left - margin.right;
const height = svgH - margin.top - margin.bottom;
const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Scales
const x = d3.scaleLinear().range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

// LOAD DATA from OWID’s public bucket :contentReference[oaicite:0]{index=0}
d3.csv(
  "https://nyc3.digitaloceanspaces.com/owid-public/data/energy/owid-energy-data.csv",
  d3.autoType
)
  .then(data => {
    const world = data.filter(d => d.iso_code === "OWID_WRL");
    console.log("Data loaded, world rows:", world.length);
    if (!world.length) {
      console.error("No OWID_WRL rows—check the CSV URL or iso_code");
      return;
    }

    // Compute the three series
    world.forEach(d => {
      d.primary        = d.primary_energy_consumption;
      d.renewablesShare= (d.renewables_consumption / d.primary) * 100;
      d.fossil         = d.coal_consumption + d.oil_consumption + d.gas_consumption;
      d.zeroCarbon     = d.nuclear_consumption + d.renewables_consumption;
    });

    // Initial domains for scene 0
    x.domain(d3.extent(world, d => d.year));
    y.domain([0, d3.max(world, d => d.primary)]);

    window.world = world;
    render();
  })
  .catch(err => console.error("Data load failed:", err));

// RENDER dispatcher
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

// SCENE 0: Total Primary Energy
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

  const last = world[world.length - 1];
  annotate(last.year, last.primary, `${last.year}: ${Math.round(last.primary)} PJ`);
}

// SCENE 1: Renewables Share
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

  const cross = world.find(d => d.renewablesShare >= 10);
  annotate(cross.year, cross.renewablesShare, `~${cross.year}: 10% Renewables`);
}

// SCENE 2: Fossil vs Zero-Carbon Stack
function scene2() {
  y.domain([0, d3.max(world, d => d.fossil + d.zeroCarbon)]);
  const series = d3.stack().keys(["fossil", "zeroCarbon"])(world);

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

  const mid = world[Math.floor(world.length / 2)];
  annotate(mid.year, mid.fossil + mid.zeroCarbon,
           `${mid.year}: Zero-carbon growth`, -60, 20);
}

// AXES helper
function drawAxes() {
  g.append("g").call(d3.axisLeft(y));
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
}

// ANNOTATION helper
function annotate(year, val, label, dx = -50, dy = -50) {
  const ann = [{
    note: { label },
    x: x(year), y: y(val),
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

// CONTROLS
d3.select("#prev").on("click", () => {
  if (currentScene > 0) currentScene--;
  render();
});
d3.select("#next").on("click", () => {
  if (currentScene < scenes.length - 1) currentScene++;
  render();
});
