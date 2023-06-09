const data = ["#511EA8", "#4928B4", "#4334BF", "#4041C7", "#3F50CC", "#3F5ED0", "#416CCE", "#4379CD", "#4784C7", "#4B8FC1", "#5098B9", "#56A0AF", "#5CA7A4", "#63AC99", "#6BB18E", "#73B583", "#7CB878", "#86BB6E", "#90BC65", "#9ABD5C", "#A4BE56", "#AFBD4F", "#B9BC4A", "#C2BA46", "#CCB742", "#D3B240", "#DAAC3D", "#DFA43B", "#E39B39", "#E68F36", "#E68234", "#E67431", "#E4632E", "#E1512A", "#DF4027", "#DC2F24"]

export function colours(n: number) {
  if (n<=data.length) {
    const spacing = Math.floor(data.length/n);
    const c = [];
    for (let j=0; j<n; j++) {
      c.push(data[j*spacing])
    }
    return c;
  }
  const c = [];
  for (let j=0; j<n; j++) {
    c.push(data[j%data.length])
  }
  return c;
}
