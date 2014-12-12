/**
 * fis.baidu.com
 */

'use strict';

var spawn = require('child_process').spawn;

exports.name = 'plugin';
exports.usage = '<command> [options]';
exports.desc = 'yog plugin tool';

var plugins = require('./config/plugins.js');
require('shelljs/global');

exports.register = function(commander) {
    var o_args = process.argv;
 
    commander
        .option('--verbose', 'output verbose help', Boolean, false);

    commander
        .command('install <name>')
        .description('install yog plugin');

    commander
        .command('list')
        .description('list all yog plugin');

    commander.action(function() {
        var args = Array.prototype.slice.call(arguments);
        var options = args.pop();
        if (options.verbose) {
            fis.log.level = fis.log.L_ALL;
            fis.log.throw = true;
        }
        var command = args.shift();
        if (commands[command]){
            if (!commands[command].apply(this, args)){
                commander.outputHelp();
            }
        } else {
            commander.outputHelp();
        }
    });
};

var commands = {
    install: install,
    list: list
};

function list(){
    console.log('\r\n ----------plugin list----------\r\n'.yellow);
    fis.util.map(plugins, function(name, item){
        console.log(' ' + name.green + ' : ' + item.info);
    });
    console.log(' \r\n ' + 'yog2 plugin install https://github.com/fex-team/yog2-plugin-session@0.0.0'.yellow + ' also works');
    return true;
}

function install(name){
    if (!name){
        return false;     
    }

    var args = Array.prototype.slice.call(arguments);
    name = name.split('@');
    var version = name.length == 2 ? name[1] : 'master';

    var conf = plugins[name[0]];

    if (!conf){
        var parsedConf = tryParseUrl(name[0]);
        if (!parsedConf){
            fis.log.warning('invalid plugin name'.red);
            list();
            return true;
        }else{
            conf = parsedConf;
        }
    }
    var scaffold = new (require('fis-scaffold-kernel'))({
        type: conf.config.type,
        log: {
            level: 0 //default show all log; set `0` == silent.
        }
    });
    fis.log.notice('Downloading and unzipping...');
    var dir = process.cwd();
    dir = lookupYog(dir);
    fis.log.notice('Yog project path: ' + dir);
    var prompts = null;
    var keyword_reg = conf.config.keyword_reg || /\{\{-([\s\S]*?)-\}\}/ig;

    scaffold.download(conf.config.repos + '@' + version, function(err, temp_path){
        if (err){
            fis.log.error(err);
        }
        var pluginInfo = require(temp_path + '/plugin.json');
        scaffold.deliver(temp_path, dir, 
            [{
                reg: /(^[\/\\]plugins[\/\\].*)/,
                release: '$&',
            },{
                reg: /(^[\/\\]conf[\/\\].*)/,
                release: '$&',
            },{
                reg: /^[\/\\]plugin.json/,
                release: '/plugins/' + pluginInfo.name + '-plugin.json',
            },{
                reg: '**',
                release: false
            }]
        );
        //安装依赖
        installDeps(dir, pluginInfo);
        fis.log.notice('Done');
    });
    return true;
}

function tryParseUrl(url){
    var conf = {
        config: {            
            'prompt': [],
            'roadmap': []
        },
        info: 'remote repo'
    };
    if (/^https?:\/\//.test(url)){
        var match = url.match(/(gitlab\.baidu\.com|github\.com)\/(.*)/);
        if (match && match.length === 3){
            switch (match[1]){
                case 'github.com':
                    conf.config.type = 'github';
                    break;
                case 'gitlab.baidu.com':
                    conf.config.type = 'gitlab';
                    break;
            }
            conf.config.repos = match[2];
            return conf;
        }
    }
    return false;
}

function installDeps(dir, pluginInfo){
    fis.util.map(pluginInfo.dependencies, function(key, version){
        var name = key + '@' + version;
        fis.log.notice('Install plugin deps: ' + name);
        exec('npm i --save ' + name);
    });
}

function lookupYog(dir){
    var root = dir.replace(/\\/g, '/'), conf, cwd = root, pos = cwd.length;
    do {
        cwd  = cwd.substring(0, pos);
        conf = cwd + '/package.json';
        if(fis.util.exists(conf)){
            root = cwd;
            break;
        } else {
            pos = cwd.lastIndexOf('/');
        }
    } while(pos > 0);
    return root;
}