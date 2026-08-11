// Main function that takes in a query object and returns a filtered result based on those parameters. The function retrieves all data from the tables, processes the source to filter the data, and then processes the match to further refine the results.

/* EXAMPLE JSON
    {
    
    //IGNORE
    "action": "separate",
    "label": "Different schools apart",
    "priority": 5,
    "config": {

        //Config this code uses to filter the data. source is the table and field to filter on, match is the value to match.
        "data": {
        "source": "entries.school",
        "match": ""
        }
    }
    }
*/
function selectData(query) {
    /* 
    //query is a js object with two entries, source and match as specified in json-rule-schema.md

        "data" = {
        "source": "",
        "match": ""
        }
        
    const sourcePath = query.source;
    const matchValues = query.match;
    const result = {};

    let tableData, finalMatches;
    let rosterData = getRosterData(); // Assume this function retrieves all tables in json format, kinda like how rosters cused to be exportable. gets all the data from all the tables (entries, slots, rules) in json format.
    tableData = resolveSource(rosterData, sourcePath);
    finalMatches = filterByMatch(tableData, matchValues);

    result = finalMatches;
    return result;
    */
}

function resolveSource(rosterData, sourcePath) {
  /*
    // if sourcePath is entries.role

    let table = '';
    if (sourcePath contains 'entries') {
        table = 'entries';
    } else if (sourcePath contains 'slots') {
        table = 'slots';
    } else if (sourcePath contains 'rules') {
        table = 'rules';
    }

    rosterData.filter(for only objects that contain 'role');

    return rosterData;
    */
}

function filterByMatch(rows, matchValues) {
    /*
    // if matchValues is 'coach'

    let matchTerm = matchValues;

    rows.filter(for only objects that contain matchTerm);

    return rows;

    */
}

function getRosterData() {
    /*
    // returns all data from all tables in json format
    // this function is a placeholder for the actual implementation that retrieves data from the database or other sources.
    */
    return {
        entries: [],
        slots: [],
        rules: []
    };
}
