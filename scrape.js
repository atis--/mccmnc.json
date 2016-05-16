#!/usr/bin/env node

const fs = require('fs');
const request = require('superagent');
const trim = require('lodash.trim');
const startsWith = require('lodash.startswith');

const url = 'http://mcc-mnc.com';
console.error(`Fetching from ${url}...`);

// fetch webpage
request
    .get(url)
    .end(function (err, res) {
        if (err) {
            console.error(err.stack);
            process.exit(1);
        }
        if (!res.ok) {
            console.error(`Unexpected status code: ${res.status}`);
            process.exit(2);
        }

        // write to file for debugging
        fs.writeFileSync('response.html', res.text);

        // parse data out of HTML content
        parse(res.text);
    });

function parse(content) {
    // parse html page source with regexp
    const regex = new RegExp(
       '<tr>'             +
       '<td>(\\d+)</td>'  +  // MCC (three digits)
       '<td>([^<]+)</td>' +  // MNC (may be `n/a`)
       '<td>([^<]+)</td>' +  // two-letter ISO country code (may be `n/a`)
       '<td>([^<]+)</td>' +  // full country name
       '<td>([^<]*)</td>' +  // E.164 country calling code (may be empty)
       '<td>([^<]*)</td>' +  // network (telecom) name (may be empty)
       '</tr>'
    );

    // split webpage into lines
    const lines = content.split('\n');

    // process each line
    const result = {};
    lines.forEach(function (line) {
        // trim whitespace
        line = trim(line);

        // ignore lines that are not table rows
        if (!startsWith(line, '<tr>') || line.length < 5)
            return;

        // parse line with regexp
        const m = line.match(regex);
        if (!m) {
            console.error(`Failed to parse line "${line}"`);
            return;
        }

        const mcc = m[1];
        const mnc = (m[2] != 'n/a') ? m[2] : '';
        const mccmnc = mcc + mnc;
        const country_name = trim(m[4]);
        const calling_code = trim(m[5]);
        const network = trim(m[6]);

        // check for dupes, concatenate network names
        if (result[mccmnc]) {
            console.error(`Duplicate entry for "${country_name}" (MCCMNC=${mccmnc}), concat `+
                          `"${result[mccmnc].network_name}" with "${network}"`);
            result[mccmnc].network_name += `, ${network}`;
            return;
        }

        // country calling code is sometimes empty
        if (calling_code.length == 0) 
            console.error(`Missing country calling code for "${country_name}" (MCCMNC=${mccmnc})`);

        // store entry
        result[mccmnc] = {
            mcc,
            mnc,
            country_iso: (m[3] != 'n/a') ? m[3].toUpperCase() : null,
            country_name,
            country_code: calling_code,
            network_name: network
        };
    });

    // output result JSON
    console.log(JSON.stringify(result, null, 4));

    console.error(`Done! (${Object.keys(result).length} entries)`);
}
