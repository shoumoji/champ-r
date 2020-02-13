import _get from 'lodash/get';
import _find from 'lodash/find';

import http from 'src/service/http';
import { saveToFile } from 'src/share/file';

// import { saveToFile } from 'src/share/file';
// import { Actions } from 'src/share/actions';

// const vm = require('vm');
// const context = {
// 	CHAMPION_POSITION: {
// 		list: {},
// 		gameVer: ``,
// 	},
// };
// vm.createContext(context);
// export const runCode = (code, varName) => {
// 	vm.runInContext(code, context);
// 	return context[varName];
// };

const API = {
	List: `https://game.gtimg.cn/images/lol/act/img/js/heroList/hero_list.js`,
	Positions: `https://lol.qq.com/act/lbp/common/guides/guideschampion_position.js`,
	detail: id => `https://lol.qq.com/act/lbp/common/guides/champDetail/champDetail_${id}.js`,
};

export const parseCode = str => {
	try {
		const [result] = str.match(/{"(.*)"}/);
		const data = JSON.parse(result);
		return data;
	} catch (err) {
		return err;
	}
};

export const getChampionList = async () => {
	try {
		const data = await http.get(API.List);
		return data;
	} catch (err) {
		return err;
	}
};

export const getChampionDetail = async id => {
	try {
		const apiUrl = API.detail(id);
		const code = await http.get(apiUrl);
		const { list } = parseCode(code);
		return list;
	} catch (err) {
		return err;
	}
};

export const getChampionPositions = async () => {
	try {
		const code = await http.get(API.Positions);
		const { list } = parseCode(code);
		return list;
	} catch (err) {
		return err;
	}
};

export const makeItem = (data, positions, champion, version) => {
	const { alias } = champion;
	const { championLane } = data;

	const result = positions.reduce((res, position) => {
		const laneItemsStr = _get(championLane, `${position}.hold3`, []);
		const rawBlocks = JSON.parse(laneItemsStr);
		const items = rawBlocks.map(i => ({
			id: i.itemid,
			count: 1,
			pRate: i.showrate,
			wRate: i.winrate,
		}));

		const item = {
			'sortrank': 1,
			priority: false,
			map: `any`,
			mode: `any`,
			type: `custom`,
			key: alias.toLowerCase(),
			champion: alias,
			position,
			title: `[LOL.QQ.COM] ${position} - ${version}`,
			fileName: `[LOL.QQ.COM]${alias}-${position}-${version}`,
			skills: [],
			// TODO
			blocks: [{
				type: `lol.qq.com`,
				items: items,
			}],
		};

		return res.concat(item);
	}, []);

	return result;
};

export default async function getItems(lolDir) {
	try {
		const [
			{
				version,
				hero: list,
			},
			positionMap,
		] = await Promise.all([
			getChampionList(),
			getChampionPositions(),
		]);

		const championIds = Object.keys(positionMap);
		const tasks = championIds.map(getChampionDetail);
		const detailList = await Promise.all(tasks);

		const items = detailList.reduce((res, item, idx) => {
			const id = championIds[idx];
			const positions = Object.keys(positionMap[id]);
			const champion = _find(list, { heroId: id });

			const block = makeItem(item, positions, champion, version);
			return res.concat(block);
		}, []);

		const fileTasks = items.map(i => saveToFile(lolDir, i));
		const result = await Promise.all(fileTasks);

		return result;
	} catch (err) {
		return err;
	}
}