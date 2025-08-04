// script.js

// Track which scene we’re on
let currentScene = 0;
const scenes = [scene0, scene1, scene2];

// Titles & sidebar narratives for each scene
const sceneInfo = [
  {
    title: "Total Primary Energy Consumption (PJ)",
    sidebar: `
      In 1965, global primary energy consumption was about 43 360 PJ.
      Over the next six decades, it soared beyond 170 000 PJ,
      reflecting industrial growth, population increases, and rising living standards worldwide.
    `
  },
  {
    title: "Renewables Share of Total Energy (%)",
    sidebar: `
      Although renewables existed in small amounts throughout the 20th century,
      their share of global energy stayed under 6% until the early 2000s.
      It wasn’t until around 2016 that renewables finally crossed the 10% mark,
      indicating a gradual shift toward cleaner sources.
    `
  },
  {
    title: "Fossil vs. Zero-Carbon Energy",
    sidebar: `
      This stacked view compares fossil fuels (gray) to zero-carbon sources (green).
      While zero-carbon energy has grown—driven by nuclear and renewables—
      fossil fuels still dominate the global energy mix as of 2023.
    `
  }
];

// Tooltip div
const tooltip = d3.select("#tooltip");

// Set up SVG and margins
const svg = d3.select("#chart");
const { width: svgW, height: svgH } = svg.node().getBoundingClientRect();
const margin = { top: 40, right: 20, bottom: 60, left: 70 };
const innerWidth  = svgW - margin.left - margin.right;
const innerHeight = svgH - margin.top  - margin.bottom;
const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Scales
const x = d3.scaleLinear().range([0, innerWidth]);
const y = d3.scaleLinear().range([innerHeight, 0]);

// Load & preprocess data
d3.csv(
  "https://nyc3.digitaloceanspaces.com/owid-public/data/energy/owid-energy-data.csv",
  d3.autoType
).then(data => {
  const worldRaw = data.filter(d => d.country === "World");
  const world = worldRaw.filter(d => Number.isFinite(d.primary_energy_consumption));
  if (!world.length) return console.error("No data to plot");

  world.forEach(d => {
    d.primary         = d.primary_energy_consumption;
    d.renewablesShare = d.renewables_consumption / d.primary * 100;
    d.fossil          = (d.coal_consumption  || 0)
                      + (d.oil_consumption   || 0)
                      + (d.gas_consumption   || 0);
    d.zeroCarbon      = (d.nuclear_consumption  || 0)
                      + (d.renewables_consumption || 0);
  });

  x.domain(d3.extent(world, d => d.year));
  y.domain([0, d3.max(world, d => d.primary)]);
  window.world = world;

  render();
}).catch(err => console.error("Data load failed:", err));

// Main render dispatcher
function render() {
  // Update scene title + sidebar text
  d3.select("#title").text(sceneInfo[currentScene].title);
  d3.select("#sidebar").html(sceneInfo[currentScene].sidebar);

  // Clear old chart & annotations
  g.selectAll("*").remove();
  d3.select("#annotation").selectAll("*").remove();

  // Draw the current scene
  scenes[currentScene]();

  // Disable buttons at the ends
  d3.select("#prev").property("disabled", currentScene === 0);
  d3.select("#next").property("disabled", currentScene === scenes.length - 1);
}

// SCENE 0: Total primary energy with hover tooltips
function scene0() {
  const line = d3.line()
    .defined(d => Number.isFinite(d.primary))
    .x(d => x(d.year))
    .y(d => y(d.primary));

  g.append("path")
    .datum(window.world)
    .attr("fill", "none")
    .attr("stroke", "#333")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Invisible circles for hover tooltips
  g.selectAll("circle.datapoint")
    .data(window.world)
    .join("circle")
      .attr("class", "datapoint")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.primary))
      .attr("r", 6)
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 1)
               .html(`${d.year}<br>${d3.format(",")(Math.round(d.primary))} PJ`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left",  (event.pageX + 10) + "px")
               .style("top",   (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

  drawAxes();
}

// SCENE 1: Renewables share with hover tooltips
function scene1() {
  y.domain([0, 100]);

  const line = d3.line()
    .defined(d => Number.isFinite(d.renewablesShare))
    .x(d => x(d.year))
    .y(d => y(d.renewablesShare));

  g.append("path")
    .datum(window.world)
    .attr("fill", "none")
    .attr("stroke", "green")
    .attr("stroke-width", 2)
    .attr("d", line);

  g.selectAll("circle.datapoint")
    .data(window.world)
    .join("circle")
      .attr("class", "datapoint")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.renewablesShare))
      .attr("r", 6)
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 1)
               .html(`${d.year}<br>${d.renewablesShare.toFixed(1)}%`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left",  (event.pageX + 10) + "px")
               .style("top",   (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

  drawAxes();
}

// SCENE 2: Stacked fossil vs zero-carbon area
function scene2() {
  y.domain([0, d3.max(window.world, d => d.fossil + d.zeroCarbon)]);

  const series = d3.stack().keys(["fossil","zeroCarbon"])(window.world);
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
}

// Draw axes with labels & units
function drawAxes() {
  // Y-axis
  g.append("g")
    .call(d3.axisLeft(y)
      .tickFormat(d => d3.format(",")(d) + " PJ"));

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 15)
    .attr("x", -innerHeight / 2)
    .attr("dy", "-1.2em")
    .style("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Primary Energy (PJ)");

  // X-axis
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + margin.bottom - 10)
    .style("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Year");
}

// Prev/Next button handlers
d3.select("#prev").on("click", () => {
  if (currentScene > 0) currentScene--;
  render();
});
d3.select("#next").on("click", () => {
  if (currentScene < scenes.length - 1) currentScene++;
  render();
});
