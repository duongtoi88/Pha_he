// Tự động đọc file Excel khi trang vừa load
window.onload = () => {
  fetch('https://duongtoi88.github.io/Pha_he/input.xlsx')
    .then(res => res.arrayBuffer())
    .then(data => {
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      window.rawRows = json;

      // Lọc các ID gốc (Đinh = "x")
      const rootIDs = json.filter(r => r.Đinh === "x").map(r => String(r.ID).replace('.0', ''));

      const select = document.createElement("select");
      select.id = "rootSelector";
      select.style.marginBottom = "10px";

      rootIDs.forEach(id => {
        const r = json.find(p => String(p.ID).replace('.0', '') === id);
        const opt = document.createElement("option");
        opt.value = id;
        opt.text = `${r["Họ và tên"]} (${id})`;
        select.appendChild(opt);
      });

      select.onchange = () => {
        const selectedID = select.value;
        const rootTree = convertToSubTree(json, selectedID);
        document.getElementById("tree-container").innerHTML = "";
        drawTree(rootTree);
      };

      document.body.insertBefore(select, document.getElementById("tree-container"));

      // Load cây ban đầu
      const defaultRoot = rootIDs[0];
      const treeData = convertToSubTree(json, defaultRoot);
      drawTree(treeData);
    })
    .catch(err => {
      console.error("Không thể đọc file Excel:", err);
    });
};

// Duyệt cây con từ ID gốc
function convertToSubTree(rows, rootID) {
  const people = {};
  const validIDs = new Set();

  rows.forEach(row => {
    const id = String(row.ID).replace('.0', '');
    people[id] = {
      id,
      name: row["Họ và tên"] || "",
      birth: row["Năm sinh"] || "",
      death: row["Năm mất"] || "",
      info: row["Thông tin chi tiết"] || "",
      father: row["ID cha"] ? String(row["ID cha"]).replace('.0', '') : null,
      mother: row["ID mẹ"] ? String(row["ID mẹ"]).replace('.0', '') : null,
      spouse: row["ID chồng"] ? String(row["ID chồng"]).replace('.0', '') : null,
      doi: row["Đời"] || "",
      dinh: row["Đinh"] || "",
      children: []
    };
  });

  // Duyệt theo con cháu của ID gốc
  function collectDescendants(id) {
    validIDs.add(id);
    rows.forEach(r => {
      const childID = String(r.ID).replace('.0', '');
      const fatherID = r["ID cha"] ? String(r["ID cha"]).replace('.0', '') : null;
      if (fatherID === id) {
        collectDescendants(childID);
      }
    });
  }

  collectDescendants(rootID);

  // Chỉ lấy những người thuộc cây con
  const treePeople = {};
  validIDs.forEach(id => {
    if (people[id]) treePeople[id] = people[id];
  });

  // Gán con cho cha
Object.values(treePeople).forEach(p => {
  if (p.father && treePeople[p.father]) {
    treePeople[p.father].children.push(p);
  }
});

// 🔽 Sắp xếp con theo năm sinh tăng dần
Object.values(treePeople).forEach(p => {
  p.children.sort((a, b) => {
    const aYear = parseInt(a.birth) || 9999;
    const bYear = parseInt(b.birth) || 9999;
    return aYear - bYear;
  });
});

  return treePeople[rootID];
}

// Vẽ cây phả hệ bằng D3.js
function drawTree(data) {
  const root = d3.hierarchy(data);

  // Tự động giãn chiều rộng theo số lá
  const numLeaves = root.leaves().length;
  const nodeWidth = 120;
  const minWidth = 1600;
  const width = Math.max(minWidth, numLeaves * nodeWidth);

  // Tính số đời (depth) lớn nhất
  const root = d3.hierarchy(data);
  const maxDepth = d3.max(root.descendants(), d => d.depth);
  const nodeHeight = 200; // khoảng cách giữa các đời

  // Tính chiều cao theo số đời
  const height = (maxDepth + 1) * nodeHeight;

  const svg = d3.select('#tree-container').append('svg')
    .attr('width', width)
    .attr('height', height+100)
    .append('g')
    .attr('transform', 'translate(80,40)');

  // Thiết lập layout cây
  const treeLayout = d3.tree().size([width - 160, height - 100]); // trừ padding trên/dưới
  treeLayout(root);
  const g = svg; // g là group đã append('g')

  // Tính bounding box của toàn bộ cây
  const bounds = root.descendants().reduce(
    (acc, d) => {
      return {
        x0: Math.min(acc.x0, d.x),
        x1: Math.max(acc.x1, d.x),
        y0: Math.min(acc.y0, d.y),
        y1: Math.max(acc.y1, d.y)
      };
    },
    { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }
  );
  
  const dx = bounds.x1 - bounds.x0;
  const dy = bounds.y1 - bounds.y0;
  const scale = Math.min(width / (dx + 160), height / (dy + 100));
  const translateX = (width - dx * scale) / 2 - bounds.x0 * scale + 80;
  const translateY = (height - dy * scale) / 2 - bounds.y0 * scale + 40;
  
  g.attr("transform", `translate(${translateX},${translateY}) scale(${scale})`);

  // Vẽ đường nối
  svg.selectAll('.link')
  .data(root.links())
  .enter()
  .append('path')
  .attr('class', 'link')
  .attr('fill', 'none')
  .attr('stroke', '#555')
  .attr('stroke-width', 2)
  .attr('d', d => {
    const x1 = d.source.x;
    const y1 = d.source.y;
    const x2 = d.target.x;
    const y2 = d.target.y;
    const midY = (y1 + y2) / 2;

    return `
      M ${x1},${y1}
      V ${midY}
      H ${x2}
      V ${y2}
    `;
  });

  // Tạo node
  const node = svg.selectAll('.node')
    .data(root.descendants())
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .on('click', (event, d) => openDetailTab(d.data.id))
    .on('mouseover', (event, d) => showQuickTooltip(event, d.data))
    .on('mouseout', () => document.getElementById('tooltip').style.display = 'none');

  // Màu sắc phân biệt theo Đinh
  node.append('rect')
    .attr('x', -40)
    .attr('y', -60)
    .attr('width', 80)
    .attr('height', 120)
    .attr('rx', 10)
    .attr('ry', 10)
    .attr('class', d => d.data.dinh === 'x' ? 'dinh-x' : 'dinh-thuong');

  // Họ tên
  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', 'translate(10, 0) rotate(0)')
    .style('font-size', '12px')
    .attr('fill', 'black')
    .text(d => d.data.name);

  // Năm sinh - năm mất
  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', 'translate(-10, 0) rotate(0)')
    .style('font-size', '12px')
    .attr('fill', 'black')
    .text(d => (d.data.birth || '') + ' - ' + (d.data.death || ''));
}
// Tooltip ngắn khi hover
function showQuickTooltip(event, data) {
  const wives = window.rawRows.filter(r => {
    const idChong = String(r["ID chồng"] || "").replace('.0', '');
    return idChong === data.id;
  });

  const children = data.children || [];

  const html = `
    <div><b>${data.name || "-"}</b> – Đời ${data.doi || "-"}</div>
    <div>${data.birth || "-"} – ${data.death || "-"}</div>
    <div><b>Vợ/Chồng:</b> ${wives.length ? wives.map(w => `- ${w["Họ và tên"]}`).join("<br>") : "-"}</div>
    <div><b>Con:</b> ${children.length ? children.map(c => `- ${c.name}`).join("<br>") : "-"}</div>
  `;

  const tooltip = document.getElementById("tooltip");
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  tooltip.style.left = (event.pageX + 10) + 'px';
  tooltip.style.top = (event.pageY + 10) + 'px';
  tooltip.style.textAlign = 'left';
}
// Click mở tab chi tiết
function openDetailTab(id) {
  window.location.href = `detail.html?id=${id}`;
}
