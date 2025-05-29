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
  const width = 1600, height = 1000;

  const svg = d3.select('#tree-container').append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', 'translate(80,40)');

  const root = d3.hierarchy(data);
  const treeLayout = d3.tree().size([width - 160, height - 100]);
  treeLayout(root);

  // Vẽ đường nối
  svg.selectAll('.link')
    .data(root.links())
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y));

  // Tạo node
  const node = svg.selectAll('.node')
    .data(root.descendants())
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .on('click', (event, d) => openDetailTab(d.data.id));
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
    .attr('class', d => d.data.dinh === 'x' ? 'dinh-x' : 'dinh-thuong')

  // Họ tên
  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', 'translate(20, 0) rotate(0)')
    .style('font-size', '12px')
    .attr('fill', 'black')
    .text(d => d.data.name);

  // Năm sinh - năm mất
  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', 'translate(-20, 0) rotate(0)')
    .style('font-size', '12px')
    .attr('fill', 'black')
    .text(d => (d.data.birth || '') + ' - ' + (d.data.death || ''));
}

function showQuickTooltip(event, data) {
  const wives = window.rawRows.filter(r => {
    const idChong = String(r["ID chồng"] || "").replace('.0', '');
    return idChong === data.id;
  });

  const children = data.children || [];

  const html = `
    <div><b>${data.name || "-"}</b> – Đời ${data.doi || "-"}</div>
    <div>${data.birth || "-"} – ${data.death || "-"}</div>
    <div><b>Vợ:</b> ${wives.length ? wives.map(w => w["Họ và tên"]).join(", ") : "-"}</div>
    <div><b>Con:</b> ${children.length ? children.map(c => c.name).join(", ") : "-"}</div>
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
  window.open(`detail.html?id=${id}`, '_blank');
}
