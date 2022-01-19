import rp from 'request-promise';
import cheerio from 'cheerio';
import fs from 'fs';
import xlsx from 'node-xlsx';
import linkify from 'linkifyjs';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fileName = 'Paulo Souza_GCCF  Formulário de Inscrição  (Responses).xlsx';
const planName = 'Form Responses 1';
const cels = {
    firstName: 4,
    lastName: 5,
    email: 2,
    cofirmEmail: 3,
    qwiklabsLink: 8,
    accepted: 9
};

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

const studentsForm = [];
const studentsApproved = [];
const studentsReproved = [];
const linksError = [];
const accessError = [];
let dataTemp = [];

let cont = 0;
let success = 0;
let negatives = 0;

console.log(" ===== Levantamento de Badges QwikLabs =====");
console.log("");
// Parse a file
console.log("Realizando a leitura da planilha de respostas.");
const workSheetsFromFile = xlsx.parse(`${__dirname}/../input/${fileName}`);

console.log("Pegando os dados da planilha");
const table = workSheetsFromFile.filter(table => {
    return (table.name == planName) ? table : false;
})

console.log("Coletando os estudantes");
table[0].data.forEach(item => {

    if (cont > 0 && item[cels.accepted] == 'Estou de acordo') {
        const student = {
            nome: `${item[cels.firstName]} ${item[cels.lastName]}`,
            email: item[cels.email],
            confereEmail: (item[cels.email] == item[cels.cofirmEmail]),
            link: item[cels.qwiklabsLink]
        }
        studentsForm.push(student);
    } else {
        negatives++;
    }
    cont++;
});
console.log("");
console.log("Total de registros: " + table[0].data.length);
console.log("Estudantes que aceitaram: " + studentsForm.length);
console.log("Estudantes que recusaram: " + negatives);
console.log("");

// Buscar Badges

cont = 0;
async function buscarBadges() {
    if (cont < studentsForm.length) {

        let student = await perfilRead(studentsForm[cont]);

        // Validando se o perfil está privado
        if (student.qwikLabsName == "Jumpstart your cloud career") {
            student.linkStatus = false;
            accessError.push(student);
        } else {
            student = await checkBadges(student);

            if (student.approved)
                studentsApproved.push(student);
            else
                studentsReproved.push(student);
        }
        cont++;
        buscarBadges();

    } else {
        toJSON();
    }
}

async function perfilRead(student) {
    let status = false;

    const link = linkify.find(student.link, 'url');

    student.link = (link[0].isLink) ? link[0].href : null;

    // Pega o corpo da Página do aluno;
    const options = {
        uri: student.link,
        transform: function (body) {
            return cheerio.load(body)
        }
    }

    student.badges = [];
    student.approved = false;

    await rp(options)
        .then(($) => {
            status = true;
            student.qwikLabsName = $('.ql-headline-1').text().trim();
            $('.profile-badge').each((i, item) => {
                const badge = {
                    name: $(item).find('.ql-subhead-1').text().trim(),
                    earned: $(item).find('.ql-body-2').text().trim()
                }
                if (badge.name !== "")
                    student.badges.push(badge)
            })
            student.countBadges = student.badges.length;
            success++;
        })
        .catch((err) => {
            linksError.push({
                'student': student,
                'err': err
            })
        });
    console.log(`Processado ${cont} de ${studentsForm.length}, Status: ${status}, Badges: ${student.countBadges}`);
    student.linkStatus = status;

    return student;
}

function toJSON() {
    //salva no banco de dados
    //console.log(JSON.stringify(dados))
    fs.writeFile(`${__dirname}/../output/students.json`, JSON.stringify(studentsForm), function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log("The file STUDENTS was saved!");
        }
    });

    fs.writeFile(`${__dirname}/../output/approveds.json`, JSON.stringify(studentsApproved), function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log("The file APPROVEDS was saved!");
        }
    });

    fs.writeFile(`${__dirname}/../output/reproveds.json`, JSON.stringify(studentsReproved), function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log("The file REPROVED was saved!");
        }
    });

    fs.writeFile(`${__dirname}/../output/errors.json`, JSON.stringify(linksError), function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log("The file ERROS was saved!");
        }
    });

    console.log("");
    console.log(' ========== TOTALIZAÇÃO ==========');
    console.log("Total de registros.........: " + studentsForm.length);
    console.log("Cancidatos que recusaram...: " + negatives);
    console.log("");

    console.log('URLs Funcionando...........: ' + success);
    console.log('URLs problemas.............: ' + linksError.length);
    console.log('Erro no perfil público.....: ' + accessError.length);
    console.log('Aprovados..................: ' + studentsApproved.length);
    console.log('Reprovados.................: ' + studentsReproved.length);

    toTable(studentsApproved, 'approved');
    toTable(studentsForm, 'students');
}

async function checkBadges(student) {
    let courses = 0;
    let skills = 0;
    let quests = 0;

    student.badges.forEach(studentBadge => {
        badgesValids.forEach(badge => {
            if (studentBadge.name.indexOf(badge.name) > -1) {
                if (badge.type == 'Course') {
                    courses++;
                    studentBadge.type = 'Course';
                }
                else if (badge.type == 'Skill') {
                    skills++;
                    studentBadge.type = 'Skill';
                }
                else {
                    quests++;
                    studentBadge.type = 'Quest';
                }
            }
        });
    });

    student.approved = (quests >= 0 && courses > 3);
    student.courses = courses;
    student.skills = skills;
    student.quests = quests;

    return student;

}

function toTable(json, name) {
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
            dataTemp.push(Object.keys(item));
            i++;
        }
        dataTemp.push(Object.values(item));
    });

    if (name == 'approved') {

        fs.writeFile(`${__dirname}/../output/approvedsTable.json`, JSON.stringify(json), function (err) {
            if (err) {
                console.log(err);
            } else {
                console.log("The file JSON was saved!");
            }
        });

    }

    var buffer = xlsx.build([{ name: 'Qwik', data: dataTemp }]); // Returns a buffer

    fs.writeFileSync(`${__dirname}/../output/xls/${name}.xlsx`, buffer);
    console.log(`Arquivo ${name}.xls gravado com sucesso!`);

    dataTemp = [];
}

console.log("Buscando Badges...");
buscarBadges();