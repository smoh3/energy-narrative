let currentScene = 0;
const scenes = [scene0, scene1, scene2];
const sceneInfo = [
  {
    title: "Total Primary Energy Consumption (PJ)",
    desc: "Global energy use rose from about 43 360 PJ in 1965 to over 170 000 PJ today."
  },
  {
    title: "Renewables Share of Total Energy (%)",
    desc: "Renewables stayed under 6 % of global energy until the 2000s, only reaching 10 % around 2016."
  },
  {
    title: "Fossil vs. Zero-Carbon Energy",
    desc: "Zero-carbon sources (nuclear + renewables) have grown but still trail behind fossil fuels."
  }
];

const tooltip = d3.select("#tooltip");
const svg = d3.select("#chart");
const { width: svgW, height: svgH } = svg.node().getBoundingClientRect();
const margin = { top: 40, right: 20, bottom: 60, left: 70 };
const innerWidth  = svgW - margin.left - margin.right;
const innerHeight = svgH - margin.top  - margin.bottom;
const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear().range([0, innerWidth]);
const y = d3.scaleLinear().range([innerHeight, 0]);

d3.csv(
  "https://nyc3.digitaloceanspaces.com/owid-public/data/energy/owid-energy-data.csv",
  d3.autoType
).then(data => {
  const worldRaw = data.filter(d => d.country === "World");
  const world = worldRaw.filter(d => Number.isFinite(d.primary_energy_consumption));
  world.forEach(d => {
    d.primary         = d.primary_energy_consumption;
    d.renewablesShare = d.renewables_consumption / d.primary * 100;
    d.fossil          = (d.coal_consumption   || 0)
                      + (d.oil_consumption    || 0)
                      + (d.gas_consumption    || 0);
    d.zeroCarbon      = (d.nuclear_consumption || 0)
                      + (d.renewables_consumption || 0);
  });
  x.domain(d3.extent(world, d => d.year));
  y.domain([0, d3.max(world, d => d.primary)]);
  window.world = world;
  render();
}).catch(err => console.error(err));

function render() {
  d3.select("#title").text(sceneInfo[currentScene].title);
  d3.select("#description").text(sceneInfo[currentScene].desc);
  g.selectAll("*").remove();
  scenes[currentScene]();
  d3.select("#prev").property("disabled", currentScene === 0);
  d3.select("#next").property("disabled", currentScene === scenes.length - 1);
}

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

  g.selectAll("circle.datapoint")
    .data(world)
    .join("circle")
      .attr("class", "datapoint")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.primary))
      .attr("r", 6)
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 1)
               .html(`${d.year}: ${d3.format(",")(Math.round(d.primary))} PJ`);
      })
      .on("mousemove", event => {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top",  (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

  drawAxes("Primary Energy (PJ)", "Year");
}

function scene1() {
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

  g.selectAll("circle.datapoint")
    .data(world)
    .join("circle")
      .attr("class", "datapoint")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.renewablesShare))
      .attr("r", 6)
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 1)
               .html(`${d.year}: ${d.renewablesShare.toFixed(1)}%`);
      })
      .on("mousemove", event => {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top",  (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

  drawAxes("Renewables Share (%)", "Year");
}

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
      .attr("fill", d => color(d.key))
      .attr("d", area);

  drawAxes("Energy (PJ)", "Year");
}

function drawAxes(yLabel, xLabel) {
  g.append("g")
    .call(d3.axisLeft(y).tickFormat(d => d3.format(",")(d) + (yLabel.includes("(%") ? "" : " PJ")));
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 15)
    .attr("x", -innerHeight / 2)
    .attr("dy", "-1.2em")
    .style("text-anchor", "middle")
    .style("font-weight", "bold")
    .text(yLabel);
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + margin.bottom - 10)
    .style("text-anchor", "middle")
    .style("font-weight", "bold")
    .text(xLabel);
}

d3.select("#prev").on("click", () => {
  if (currentScene > 0) currentScene--;
  render();
});
d3.select("#next").on("click", () => {
  if (currentScene < scenes.length - 1) currentScene++;
  render();
});
