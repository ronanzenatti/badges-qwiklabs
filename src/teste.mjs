import fs from 'fs';
import xlsx from 'node-xlsx';

var jsonData = fs.readFileSync("../output/approveds.json", "utf8");

var json = JSON.parse(jsonData);

const badgesValids = [
    { name: 'Google Cloud Computing Foundations: Cloud Computing Fundamentals', type: 'Course' },
    { name: 'Google Cloud Computing Foundations: Infrastructure in Google Cloud', type: 'Course' },
    { name: 'Google Cloud Computing Foundations: Networking and Security in Google Cloud', type: 'Course' },
    { name: 'Google Cloud Computing Foundations: Data, ML, and AI in Google Cloud', type: 'Course' },
    { name: 'Create and Manage Cloud Resources', type: 'Skill' },
    { name: 'Perform Foundational Infrastructure Tasks in Google Cloud', type: 'Skill' },
    { name: 'Perform Foundational Infrastructure Tasks in Google Cloud', type: 'Skill' },
    { name: 'Build and Secure Networks in Google Cloud', type: 'Skill' },
    { name: 'Perform Foundational Data, ML, and AI Tasks in Google Cloud', type: 'Skill' },
    { name: 'Google Cloud Essentials', type: 'Quest' }
];

const data = [];

function toTable() {
    let i = 0;
    json.forEach(item => {
        item.badgesValids = 0;

        badgesValids.forEach(badge => {
            item[badge.name] = '';
            item.badges.forEach(earned => {
                if (earned.name.indexOf(badge.name) > -1) {
                    item[badge.name] = earned.earned;
                    item.badgesValids++;
                }
            })
        });
        delete item.badges;

        if (i == 0) {
            data.push(Object.keys(item));
            i++;
        }
        data.push(Object.values(item));
    });

    fs.writeFileSync(`../output/table.json`, JSON.stringify(json), function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log("The file JSON was saved!");
        }
    });



    var buffer = xlsx.build([{ name: 'Qwik', data: data }]); // Returns a buffer

    fs.writeFileSync('./teste1.xlxs', buffer);
}

toTable();