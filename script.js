const EPSILON = 1e-9;

const elements = {
    modeSelect: document.getElementById('mode-select'),
    eq2Card: document.getElementById('eq2-card'),
    logicalOp: document.getElementById('logical-operator'),
    mathFormula: document.getElementById('math-formula'),
    solutionFormula: document.getElementById('solution-formula'),
    intervalText: document.getElementById('interval-text'),
    statusText: document.getElementById('status-text'),
    explanationText: document.getElementById('explanation-text'),
    stepsList: document.getElementById('steps-list'),
    legend: document.getElementById('legend'),
    svg: document.getElementById('number-line'),
    exampleButtons: Array.from(document.querySelectorAll('.example-btn'))
};

const conditionConfigs = [1, 2].map((index) => ({
    index,
    leftCoef: document.getElementById(`lcoef${index}`),
    leftConst: document.getElementById(`lconst${index}`),
    op: document.getElementById(`op${index}`),
    rightCoef: document.getElementById(`rcoef${index}`),
    rightConst: document.getElementById(`rconst${index}`),
    preview: document.getElementById(`eq${index}-preview`)
}));

const svgConfig = {
    width: 860,
    height: 320,
    paddingX: 70,
    axisY: 220,
    bandHeight: 40,
    bandGap: 24,
    topBandY: 48
};

const COLORS = {
    axis: '#334155',
    grid: '#e2e8f0',
    labels: '#1e293b',
    cond1Fill: 'rgba(20, 184, 166, 0.30)',
    cond1Stroke: '#0d9488',
    cond2Fill: 'rgba(225, 29, 72, 0.24)',
    cond2Stroke: '#e11d48',
    finalFill: 'rgba(37, 99, 235, 0.24)',
    finalStroke: '#2563eb'
};

const EXAMPLES = {
    single: {
        mode: 'single',
        conditions: [
            { leftCoef: 2, leftConst: 3, op: '>', rightCoef: 0, rightConst: 5 },
            { leftCoef: 1, leftConst: 0, op: '<', rightCoef: 0, rightConst: 6 }
        ]
    },
    and: {
        mode: 'and',
        conditions: [
            { leftCoef: 2, leftConst: -1, op: '>=', rightCoef: 0, rightConst: 3 },
            { leftCoef: -1, leftConst: 8, op: '>', rightCoef: 0, rightConst: 2 }
        ]
    },
    or: {
        mode: 'or',
        conditions: [
            { leftCoef: 1, leftConst: 0, op: '<', rightCoef: 0, rightConst: -2 },
            { leftCoef: 2, leftConst: -1, op: '>=', rightCoef: 0, rightConst: 7 }
        ]
    }
};

function renderLatex(target, latex, displayMode = false) {
    katex.render(latex, target, {
        throwOnError: false,
        displayMode
    });
}

function cleanNumber(value) {
    if (!Number.isFinite(value)) {
        return value;
    }

    const rounded = Number(value.toFixed(6));
    return Math.abs(rounded) < EPSILON ? 0 : rounded;
}

function numbersEqual(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return a === b;
    }

    return Math.abs(a - b) < EPSILON;
}

function formatNumber(value) {
    if (value === Infinity) {
        return '∞';
    }
    if (value === -Infinity) {
        return '-∞';
    }

    const cleaned = cleanNumber(value);
    if (Number.isInteger(cleaned)) {
        return String(cleaned);
    }

    return cleaned.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function toDisplayOp(op) {
    if (op === '>=') {
        return '≥';
    }
    if (op === '<=') {
        return '≤';
    }
    return op;
}

function toLatexOp(op) {
    if (op === '>=') {
        return '\\ge';
    }
    if (op === '<=') {
        return '\\le';
    }
    return op;
}

function flipOperator(op) {
    if (op === '>') {
        return '<';
    }
    if (op === '>=') {
        return '<=';
    }
    if (op === '<') {
        return '>';
    }
    return '>=';
}

function compareBoundary(a, b) {
    if (a === b) {
        return 0;
    }
    if (a === -Infinity || b === Infinity) {
        return -1;
    }
    if (a === Infinity || b === -Infinity) {
        return 1;
    }
    if (numbersEqual(a, b)) {
        return 0;
    }
    return a < b ? -1 : 1;
}

function buildExpression(coef, constant) {
    const safeCoef = cleanNumber(coef);
    const safeConst = cleanNumber(constant);
    const terms = [];

    if (!numbersEqual(safeCoef, 0)) {
        if (numbersEqual(safeCoef, 1)) {
            terms.push('x');
        } else if (numbersEqual(safeCoef, -1)) {
            terms.push('-x');
        } else {
            terms.push(`${formatNumber(safeCoef)}x`);
        }
    }

    if (!numbersEqual(safeConst, 0) || terms.length === 0) {
        if (terms.length === 0) {
            terms.push(formatNumber(safeConst));
        } else {
            terms.push(`${safeConst >= 0 ? '+' : '-'} ${formatNumber(Math.abs(safeConst))}`);
        }
    }

    return terms.join(' ');
}

function readNumber(input) {
    const value = parseFloat(input.value);
    return Number.isFinite(value) ? value : 0;
}

function readCondition(config) {
    return {
        leftCoef: readNumber(config.leftCoef),
        leftConst: readNumber(config.leftConst),
        op: config.op.value,
        rightCoef: readNumber(config.rightCoef),
        rightConst: readNumber(config.rightConst)
    };
}

function evaluateRelation(left, op, right) {
    if (op === '>') {
        return left > right + EPSILON;
    }
    if (op === '>=') {
        return left > right - EPSILON || numbersEqual(left, right);
    }
    if (op === '<') {
        return left < right - EPSILON;
    }
    return left < right + EPSILON || numbersEqual(left, right);
}

function makeInterval(left, right, leftClosed, rightClosed) {
    return { left, right, leftClosed, rightClosed };
}

function isPointInterval(interval) {
    return Number.isFinite(interval.left)
        && Number.isFinite(interval.right)
        && numbersEqual(interval.left, interval.right)
        && interval.leftClosed
        && interval.rightClosed;
}

function isValidInterval(interval) {
    const relation = compareBoundary(interval.left, interval.right);
    if (relation < 0) {
        return true;
    }
    if (relation > 0) {
        return false;
    }
    return interval.leftClosed && interval.rightClosed;
}

function shouldMergeIntervals(a, b) {
    const relation = compareBoundary(b.left, a.right);
    if (relation < 0) {
        return true;
    }
    if (relation > 0) {
        return false;
    }
    return a.rightClosed || b.leftClosed;
}

function mergeIntervals(a, b) {
    const rightRelation = compareBoundary(a.right, b.right);
    let right = a.right;
    let rightClosed = a.rightClosed;

    if (rightRelation < 0) {
        right = b.right;
        rightClosed = b.rightClosed;
    } else if (rightRelation === 0) {
        rightClosed = a.rightClosed || b.rightClosed;
    }

    return {
        left: a.left,
        right,
        leftClosed: a.leftClosed,
        rightClosed
    };
}

function normalizeSet(intervals) {
    const sorted = intervals
        .filter(isValidInterval)
        .map((interval) => ({ ...interval }))
        .sort((a, b) => {
            const leftRelation = compareBoundary(a.left, b.left);
            if (leftRelation !== 0) {
                return leftRelation;
            }
            if (a.leftClosed === b.leftClosed) {
                return 0;
            }
            return a.leftClosed ? -1 : 1;
        });

    const merged = [];
    for (const interval of sorted) {
        if (merged.length === 0) {
            merged.push(interval);
            continue;
        }

        const previous = merged[merged.length - 1];
        if (shouldMergeIntervals(previous, interval)) {
            merged[merged.length - 1] = mergeIntervals(previous, interval);
        } else {
            merged.push(interval);
        }
    }

    return merged;
}

function intervalSetFromInequality(op, boundary) {
    if (op === '>') {
        return [makeInterval(boundary, Infinity, false, false)];
    }
    if (op === '>=') {
        return [makeInterval(boundary, Infinity, true, false)];
    }
    if (op === '<') {
        return [makeInterval(-Infinity, boundary, false, false)];
    }
    return [makeInterval(-Infinity, boundary, false, true)];
}

function intersectIntervals(a, b) {
    let left = a.left;
    let leftClosed = a.leftClosed;
    const leftRelation = compareBoundary(a.left, b.left);
    if (leftRelation < 0) {
        left = b.left;
        leftClosed = b.leftClosed;
    } else if (leftRelation === 0) {
        leftClosed = a.leftClosed && b.leftClosed;
    }

    let right = a.right;
    let rightClosed = a.rightClosed;
    const rightRelation = compareBoundary(a.right, b.right);
    if (rightRelation > 0) {
        right = b.right;
        rightClosed = b.rightClosed;
    } else if (rightRelation === 0) {
        rightClosed = a.rightClosed && b.rightClosed;
    }

    const interval = makeInterval(left, right, leftClosed, rightClosed);
    return isValidInterval(interval) ? interval : null;
}

function intersectSets(setA, setB) {
    const result = [];
    for (const intervalA of setA) {
        for (const intervalB of setB) {
            const intersection = intersectIntervals(intervalA, intervalB);
            if (intersection) {
                result.push(intersection);
            }
        }
    }
    return normalizeSet(result);
}

function unionSets(setA, setB) {
    return normalizeSet([...setA, ...setB]);
}

function isAllRealsSet(solutionSet) {
    return solutionSet.length === 1
        && solutionSet[0].left === -Infinity
        && solutionSet[0].right === Infinity;
}

function intervalToInequalityText(interval) {
    if (isPointInterval(interval)) {
        return `x = ${formatNumber(interval.left)}`;
    }
    if (interval.left === -Infinity) {
        return `x ${interval.rightClosed ? '≤' : '<'} ${formatNumber(interval.right)}`;
    }
    if (interval.right === Infinity) {
        return `x ${interval.leftClosed ? '≥' : '>'} ${formatNumber(interval.left)}`;
    }

    const leftOp = interval.leftClosed ? '≤' : '<';
    const rightOp = interval.rightClosed ? '≤' : '<';
    return `${formatNumber(interval.left)} ${leftOp} x ${rightOp} ${formatNumber(interval.right)}`;
}

function intervalToInequalityLatex(interval) {
    if (isPointInterval(interval)) {
        return `x = ${formatNumber(interval.left)}`;
    }
    if (interval.left === -Infinity) {
        return `x ${interval.rightClosed ? '\\le' : '<'} ${formatNumber(interval.right)}`;
    }
    if (interval.right === Infinity) {
        return `x ${interval.leftClosed ? '\\ge' : '>'} ${formatNumber(interval.left)}`;
    }

    const leftOp = interval.leftClosed ? '\\le' : '<';
    const rightOp = interval.rightClosed ? '\\le' : '<';
    return `${formatNumber(interval.left)} ${leftOp} x ${rightOp} ${formatNumber(interval.right)}`;
}

function intervalToText(interval) {
    if (isPointInterval(interval)) {
        return `{${formatNumber(interval.left)}}`;
    }

    const leftBracket = interval.leftClosed ? '[' : '(';
    const rightBracket = interval.rightClosed ? ']' : ')';
    const left = interval.left === -Infinity ? '-∞' : formatNumber(interval.left);
    const right = interval.right === Infinity ? '∞' : formatNumber(interval.right);
    return `${leftBracket}${left}, ${right}${rightBracket}`;
}

function intervalToLatex(interval) {
    if (isPointInterval(interval)) {
        return `\\{${formatNumber(interval.left)}\\}`;
    }

    const leftBracket = interval.leftClosed ? '[' : '(';
    const rightBracket = interval.rightClosed ? ']' : ')';
    const left = interval.left === -Infinity ? '-\\infty' : formatNumber(interval.left);
    const right = interval.right === Infinity ? '\\infty' : formatNumber(interval.right);
    return `${leftBracket}${left}, ${right}${rightBracket}`;
}

function setToSolutionText(solutionSet) {
    if (solutionSet.length === 0) {
        return '解なし';
    }
    if (isAllRealsSet(solutionSet)) {
        return 'すべての実数';
    }
    return solutionSet.map(intervalToInequalityText).join(' または ');
}

function setToSolutionLatex(solutionSet) {
    if (solutionSet.length === 0) {
        return '\\varnothing';
    }
    if (isAllRealsSet(solutionSet)) {
        return 'x \\in \\mathbb{R}';
    }
    return solutionSet.map(intervalToInequalityLatex).join(' \\;\\text{または}\\; ');
}

function setToIntervalText(solutionSet) {
    if (solutionSet.length === 0) {
        return '∅';
    }
    if (isAllRealsSet(solutionSet)) {
        return '(-∞, ∞)';
    }
    return solutionSet.map(intervalToText).join(' ∪ ');
}

function setToIntervalLatex(solutionSet) {
    if (solutionSet.length === 0) {
        return '\\varnothing';
    }
    if (isAllRealsSet(solutionSet)) {
        return '(-\\infty, \\infty)';
    }
    return solutionSet.map(intervalToLatex).join(' \\cup ');
}

function classifySolutionSet(solutionSet) {
    if (solutionSet.length === 0) {
        return 'あてはまる数はありません';
    }
    if (isAllRealsSet(solutionSet)) {
        return '全部の数があてはまります';
    }
    if (solutionSet.length === 1) {
        const interval = solutionSet[0];
        if (isPointInterval(interval)) {
            return '境目の1点だけ';
        }
        if (interval.left === -Infinity || interval.right === Infinity) {
            return '片方へずっと続く範囲';
        }
        return 'ひとつながりの範囲';
    }
    return `${solutionSet.length}つに分かれる範囲`;
}

function solveCondition(condition) {
    const netCoef = cleanNumber(condition.leftCoef - condition.rightCoef);
    const netConst = cleanNumber(condition.rightConst - condition.leftConst);
    const originalLatex = `${buildExpression(condition.leftCoef, condition.leftConst)} ${toLatexOp(condition.op)} ${buildExpression(condition.rightCoef, condition.rightConst)}`;
    const collectedLatex = `${buildExpression(netCoef, 0)} ${toLatexOp(condition.op)} ${formatNumber(netConst)}`;

    if (numbersEqual(netCoef, 0)) {
        const alwaysTrue = evaluateRelation(0, condition.op, netConst);
        const solutionSet = alwaysTrue ? [makeInterval(-Infinity, Infinity, false, false)] : [];
        return {
            originalLatex,
            collectedLatex,
            solutionLatex: alwaysTrue ? 'x \\in \\mathbb{R}' : '\\varnothing',
            solutionText: alwaysTrue ? 'すべての実数' : '解なし',
            intervalLatex: setToIntervalLatex(solutionSet),
            solutionSet,
            boundary: null,
            steps: [
                { label: 'はじめ', latex: originalLatex },
                { label: 'xを集める', latex: collectedLatex },
                { label: '結果', latex: alwaysTrue ? 'x \\in \\mathbb{R}' : '\\varnothing' }
            ]
        };
    }

    const boundary = cleanNumber(netConst / netCoef);
    const solvedOp = netCoef > 0 ? condition.op : flipOperator(condition.op);
    const solutionSet = intervalSetFromInequality(solvedOp, boundary);
    const solutionLatex = `x ${toLatexOp(solvedOp)} ${formatNumber(boundary)}`;

    return {
        originalLatex,
        collectedLatex,
        solutionLatex,
        solutionText: setToSolutionText(solutionSet),
        intervalLatex: setToIntervalLatex(solutionSet),
        solutionSet,
        boundary,
        steps: [
            { label: 'はじめ', latex: originalLatex },
            { label: 'xを集める', latex: collectedLatex },
            { label: 'こたえ', latex: solutionLatex }
        ]
    };
}

function buildInputText(condition) {
    return `${buildExpression(condition.leftCoef, condition.leftConst)} ${toDisplayOp(condition.op)} ${buildExpression(condition.rightCoef, condition.rightConst)}`;
}

function buildStatusText(mode, solutionSet) {
    const summary = classifySolutionSet(solutionSet);
    if (mode === 'single') {
        return summary;
    }
    if (mode === 'and') {
        return `両方OKのところ: ${summary}`;
    }
    return `どちらかOKのところ: ${summary}`;
}

function buildExplanation(mode, solvedConditions, finalSet) {
    const opening = mode === 'single'
        ? 'まず左辺と右辺を整理して、x だけの形にします。最後に、その範囲を数直線の青い太線にしています。'
        : mode === 'and'
            ? '2つの式を別々に x の範囲へ直します。「かつ」は、両方の色が重なるところだけを答えにします。'
            : '2つの式を別々に x の範囲へ直します。「または」は、どちらか一方でも当てはまるところを全部答えにします。';

    const conditionText = solvedConditions
        .map((solved, index) => `条件${index + 1}は ${solved.solutionText}`)
        .join('、');

    return `${opening} ${conditionText}。最終的なこたえは ${setToSolutionText(finalSet)} です。`;
}

function renderSteps(mode, solvedConditions, finalSet) {
    elements.stepsList.innerHTML = '';

    const appendSection = (title, rows) => {
        const section = document.createElement('section');
        section.className = 'step-section';

        const heading = document.createElement('h4');
        heading.textContent = title;
        section.appendChild(heading);

        for (const row of rows) {
            const rowElement = document.createElement('div');
            rowElement.className = 'step-row';

            const label = document.createElement('span');
            label.className = 'step-label';
            label.textContent = row.label;

            const formula = document.createElement('span');
            formula.className = 'step-formula';
            renderLatex(formula, row.latex, false);

            rowElement.appendChild(label);
            rowElement.appendChild(formula);
            section.appendChild(rowElement);
        }

        elements.stepsList.appendChild(section);
    };

    solvedConditions.forEach((solved, index) => {
        appendSection(`条件 ${index + 1}`, solved.steps);
    });

    if (mode !== 'single') {
        appendSection('まとめ', [
            {
                label: mode === 'and' ? '両方OK' : 'どちらかOK',
                latex: `${solvedConditions[0].intervalLatex} ${mode === 'and' ? '\\cap' : '\\cup'} ${solvedConditions[1].intervalLatex} = ${setToIntervalLatex(finalSet)}`
            },
            {
                label: 'こたえ',
                latex: setToSolutionLatex(finalSet)
            }
        ]);
    }
}

function renderLegend(mode) {
    const items = [
        { label: '条件1の範囲', className: 'cond1' }
    ];

    if (mode !== 'single') {
        items.push({ label: '条件2の範囲', className: 'cond2' });
    }

    items.push({ label: '最終のこたえ', className: 'final' });

    elements.legend.innerHTML = items.map((item) => `
        <div class="legend-item">
            <span class="legend-swatch ${item.className}"></span>
            <span>${item.label}</span>
        </div>
    `).join('');
}

function computeTickStep(span) {
    const rough = span / 8;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const normalized = rough / magnitude;

    if (normalized <= 1) {
        return magnitude;
    }
    if (normalized <= 2) {
        return 2 * magnitude;
    }
    if (normalized <= 5) {
        return 5 * magnitude;
    }
    return 10 * magnitude;
}

function collectPlotPoints(solvedConditions, finalSet) {
    const points = [];

    solvedConditions.forEach((solved) => {
        if (Number.isFinite(solved.boundary)) {
            points.push(solved.boundary);
        }
    });

    finalSet.forEach((interval) => {
        if (Number.isFinite(interval.left)) {
            points.push(interval.left);
        }
        if (Number.isFinite(interval.right)) {
            points.push(interval.right);
        }
    });

    return points;
}

function computePlotRange(points) {
    if (points.length === 0) {
        return { min: -5, max: 5, step: 1 };
    }

    let min = Math.min(...points);
    let max = Math.max(...points);

    if (numbersEqual(min, max)) {
        min -= 3;
        max += 3;
    }

    const span = max - min;
    const padding = Math.max(1, span * 0.35);
    let plotMin = min - padding;
    let plotMax = max + padding;

    if (plotMin > 0 && plotMin < padding * 1.5) {
        plotMin = 0;
    }
    if (plotMax < 0 && Math.abs(plotMax) < padding * 1.5) {
        plotMax = 0;
    }

    const step = computeTickStep(plotMax - plotMin);
    plotMin = Math.floor(plotMin / step) * step;
    plotMax = Math.ceil(plotMax / step) * step;

    if (numbersEqual(plotMin, plotMax)) {
        plotMax = plotMin + step * 4;
    }

    return {
        min: cleanNumber(plotMin),
        max: cleanNumber(plotMax),
        step: cleanNumber(step)
    };
}

function valueToX(value, plotRange) {
    const innerWidth = svgConfig.width - (svgConfig.paddingX * 2);
    return svgConfig.paddingX + ((value - plotRange.min) / (plotRange.max - plotRange.min)) * innerWidth;
}

function createSvgElement(tagName, attributes) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
    return element;
}

function appendAxisDefinitions(svg) {
    const defs = createSvgElement('defs', {});

    defs.appendChild(createSvgElement('marker', {
        id: 'axis-arrow',
        viewBox: '0 0 10 10',
        refX: '9',
        refY: '5',
        markerWidth: '7',
        markerHeight: '7',
        orient: 'auto'
    }));
    defs.lastChild.appendChild(createSvgElement('path', {
        d: 'M 0 0 L 10 5 L 0 10 z',
        fill: COLORS.axis
    }));

    defs.appendChild(createSvgElement('marker', {
        id: 'final-arrow-end',
        viewBox: '0 0 10 10',
        refX: '9',
        refY: '5',
        markerWidth: '7',
        markerHeight: '7',
        orient: 'auto'
    }));
    defs.lastChild.appendChild(createSvgElement('path', {
        d: 'M 0 0 L 10 5 L 0 10 z',
        fill: COLORS.finalStroke
    }));

    defs.appendChild(createSvgElement('marker', {
        id: 'final-arrow-start',
        viewBox: '0 0 10 10',
        refX: '1',
        refY: '5',
        markerWidth: '7',
        markerHeight: '7',
        orient: 'auto'
    }));
    defs.lastChild.appendChild(createSvgElement('path', {
        d: 'M 10 0 L 0 5 L 10 10 z',
        fill: COLORS.finalStroke
    }));

    svg.appendChild(defs);
}

function drawEndpoint(svg, x, y, closed, color, radius) {
    svg.appendChild(createSvgElement('circle', {
        cx: x,
        cy: y,
        r: radius,
        fill: closed ? color : '#ffffff',
        stroke: color,
        'stroke-width': closed ? 3.5 : 3
    }));
}

function drawAxis(svg, plotRange) {
    const innerLeft = svgConfig.paddingX;
    const innerRight = svgConfig.width - svgConfig.paddingX;

    for (let tick = plotRange.min; tick <= plotRange.max + EPSILON; tick = cleanNumber(tick + plotRange.step)) {
        const x = valueToX(tick, plotRange);
        svg.appendChild(createSvgElement('line', {
            x1: x,
            y1: svgConfig.topBandY - 12,
            x2: x,
            y2: svgConfig.axisY + 28,
            stroke: COLORS.grid,
            'stroke-width': 1.2,
            'opacity': 0.6
        }));

        svg.appendChild(createSvgElement('text', {
            x,
            y: svgConfig.axisY + 48,
            'text-anchor': 'middle',
            'font-size': 15,
            'font-weight': '500',
            'font-family': 'M PLUS Rounded 1c, sans-serif',
            fill: COLORS.labels
        })).textContent = formatNumber(tick);
    }

    svg.appendChild(createSvgElement('line', {
        x1: innerLeft,
        y1: svgConfig.axisY,
        x2: innerRight,
        y2: svgConfig.axisY,
        stroke: COLORS.axis,
        'stroke-width': 3,
        'marker-start': 'url(#axis-arrow)',
        'marker-end': 'url(#axis-arrow)'
    }));
}

function drawBand(svg, solutionSet, plotRange, options) {
    const { label, y, fill, stroke } = options;

    const labelText = createSvgElement('text', {
        x: svgConfig.paddingX,
        y: y - 14,
        'text-anchor': 'start',
        'font-size': 15,
        'font-weight': 'bold',
        'font-family': 'M PLUS Rounded 1c, sans-serif',
        fill: COLORS.labels
    });
    labelText.textContent = label;
    svg.appendChild(labelText);

    if (solutionSet.length === 0) {
        return;
    }

    solutionSet.forEach((interval) => {
        const x1 = interval.left === -Infinity ? svgConfig.paddingX : valueToX(interval.left, plotRange);
        const x2 = interval.right === Infinity ? svgConfig.width - svgConfig.paddingX : valueToX(interval.right, plotRange);
        const width = Math.max(4, x2 - x1);

        svg.appendChild(createSvgElement('rect', {
            x: x1,
            y,
            width,
            height: svgConfig.bandHeight,
            rx: 14,
            fill,
            stroke,
            'stroke-width': 2.5
        }));

        if (interval.left !== -Infinity) {
            drawEndpoint(svg, x1, y + (svgConfig.bandHeight / 2), interval.leftClosed, stroke, 6.5);
        }
        if (interval.right !== Infinity) {
            drawEndpoint(svg, x2, y + (svgConfig.bandHeight / 2), interval.rightClosed, stroke, 6.5);
        }
    });
}

function drawFinalSolution(svg, finalSet, plotRange) {
    if (finalSet.length === 0) {
        const noSolution = createSvgElement('text', {
            x: svgConfig.width / 2,
            y: svgConfig.axisY - 28,
            'text-anchor': 'middle',
            'font-size': 18,
            'font-weight': 'bold',
            'font-family': 'M PLUS Rounded 1c, sans-serif',
            fill: COLORS.finalStroke
        });
        noSolution.textContent = 'あてはまる数なし';
        svg.appendChild(noSolution);
        return;
    }

    finalSet.forEach((interval) => {
        const x1 = interval.left === -Infinity ? svgConfig.paddingX : valueToX(interval.left, plotRange);
        const x2 = interval.right === Infinity ? svgConfig.width - svgConfig.paddingX : valueToX(interval.right, plotRange);

        if (isPointInterval(interval)) {
            drawEndpoint(svg, x1, svgConfig.axisY, true, COLORS.finalStroke, 9);
            return;
        }

        svg.appendChild(createSvgElement('line', {
            x1,
            y1: svgConfig.axisY,
            x2,
            y2: svgConfig.axisY,
            stroke: COLORS.finalStroke,
            'stroke-width': 13,
            'stroke-linecap': 'round',
            'marker-start': interval.left === -Infinity ? 'url(#final-arrow-start)' : '',
            'marker-end': interval.right === Infinity ? 'url(#final-arrow-end)' : ''
        }));

        if (interval.left !== -Infinity) {
            drawEndpoint(svg, x1, svgConfig.axisY, interval.leftClosed, COLORS.finalStroke, 8.5);
        }
        if (interval.right !== Infinity) {
            drawEndpoint(svg, x2, svgConfig.axisY, interval.rightClosed, COLORS.finalStroke, 8.5);
        }
    });
}

function renderNumberLine(mode, solvedConditions, finalSet) {
    elements.svg.innerHTML = '';
    appendAxisDefinitions(elements.svg);

    const plotRange = computePlotRange(collectPlotPoints(solvedConditions, finalSet));
    drawAxis(elements.svg, plotRange);

    drawBand(elements.svg, solvedConditions[0].solutionSet, plotRange, {
        label: '条件1でOK',
        y: svgConfig.topBandY,
        fill: COLORS.cond1Fill,
        stroke: COLORS.cond1Stroke
    });

    if (mode !== 'single') {
        drawBand(elements.svg, solvedConditions[1].solutionSet, plotRange, {
            label: '条件2でOK',
            y: svgConfig.topBandY + svgConfig.bandHeight + svgConfig.bandGap,
            fill: COLORS.cond2Fill,
            stroke: COLORS.cond2Stroke
        });
    }

    drawFinalSolution(elements.svg, finalSet, plotRange);
}

function applyExample(name) {
    const example = EXAMPLES[name];
    if (!example) {
        return;
    }

    elements.modeSelect.value = example.mode;
    example.conditions.forEach((condition, index) => {
        const config = conditionConfigs[index];
        config.leftCoef.value = condition.leftCoef;
        config.leftConst.value = condition.leftConst;
        config.op.value = condition.op;
        config.rightCoef.value = condition.rightCoef;
        config.rightConst.value = condition.rightConst;
    });

    update();
}

function update() {
    const mode = elements.modeSelect.value;
    const conditions = conditionConfigs.map(readCondition);

    elements.eq2Card.classList.toggle('hidden', mode === 'single');
    elements.logicalOp.classList.toggle('hidden', mode === 'single');
    elements.logicalOp.textContent = mode === 'and' ? 'かつ' : 'または';

    conditionConfigs.forEach((config, index) => {
        config.preview.textContent = buildInputText(conditions[index]);
    });

    const solvedConditions = conditions.map(solveCondition);
    const activeConditions = mode === 'single' ? [solvedConditions[0]] : solvedConditions;

    let finalSet = activeConditions[0].solutionSet;
    if (mode === 'and') {
        finalSet = intersectSets(solvedConditions[0].solutionSet, solvedConditions[1].solutionSet);
    } else if (mode === 'or') {
        finalSet = unionSets(solvedConditions[0].solutionSet, solvedConditions[1].solutionSet);
    }

    const inputLatex = mode === 'single'
        ? solvedConditions[0].originalLatex
        : `${solvedConditions[0].originalLatex} \\quad \\text{${mode === 'and' ? 'かつ' : 'または'}} \\quad ${solvedConditions[1].originalLatex}`;

    renderLatex(elements.mathFormula, inputLatex, true);
    renderLatex(elements.solutionFormula, setToSolutionLatex(finalSet), true);

    elements.intervalText.textContent = setToIntervalText(finalSet);
    elements.statusText.textContent = buildStatusText(mode, finalSet);
    elements.explanationText.textContent = buildExplanation(mode, activeConditions, finalSet);

    renderLegend(mode);
    renderNumberLine(mode, activeConditions, finalSet);
    renderSteps(mode, activeConditions, finalSet);
}

const interactiveElements = [
    elements.modeSelect,
    ...conditionConfigs.flatMap((config) => [
        config.leftCoef,
        config.leftConst,
        config.op,
        config.rightCoef,
        config.rightConst
    ])
];

interactiveElements.forEach((element) => {
    element.addEventListener('input', update);
    element.addEventListener('change', update);
});

conditionConfigs.forEach((config) => {
    [config.leftCoef, config.leftConst, config.rightCoef, config.rightConst].forEach((input) => {
        input.addEventListener('blur', () => {
            if (input.value === '' || Number.isNaN(parseFloat(input.value))) {
                input.value = '0';
                update();
            }
        });
    });
});

elements.exampleButtons.forEach((button) => {
    button.addEventListener('click', () => {
        applyExample(button.dataset.example);
    });
});

update();
