//第1步:获取主入口文件
//第2步:安装npm install @babel/parser 解析AST语法树
//第3步:安装npm install @babel/parser收集依赖(遍历AST,寻找import语句)
//第4步:安装npm install @babel/core @babel/preset-env将ES6的AST语法树转化成ES5
//第5步:递归解析所有依赖
//第6步:定义require与exports,通过eval执行代码,并且导出文件

const fs = require('fs')
const parser = require('@babel/parser')
const path = require('path')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')

const getModuleInfo = (file) => {
    const body = fs.readFileSync(file, 'utf-8')
    const ast = parser.parse(body, {
        sourceType: 'module' //表示我们要解析的是ES模块
    });

    const deps = {} //存储依赖信息
    traverse(ast, {
        ImportDeclaration({ node }) { //ImportDeclaration方法代表的是对type类型为ImportDeclaration的节点的处理
            const dirname = path.dirname(file)
            const abspath = './' + path.join(dirname, node.source.value) //value指的是什么意思呢？其实就是import的值
            deps[node.source.value] = abspath
        }
    })
    const { code } = babel.transformFromAst(ast, null, { //转换后的代码
        presets: ["@babel/preset-env"]
    })
    const moduleInfo = { file, deps, code }
    return moduleInfo
}

//递归解析所有依赖
const parseModules = (file) => {
    const entry = getModuleInfo(file)
    const temp = [entry]
    for (let i = 0; i < temp.length; i++) {
        const deps = temp[i].deps
        if (deps) {
            for (const key in deps) {
                if (deps.hasOwnProperty(key)) {
                    temp.push(getModuleInfo(deps[key]))
                }
            }
        }
    }

    const depsGraph = {}
    temp.forEach(moduleInfo => {
        depsGraph[moduleInfo.file] = {
            deps: moduleInfo.deps,
            code: moduleInfo.code
        }
    })
    return depsGraph
}


//定义require与exports,通过eval执行代码
const bundle = (file) => {
    const depsGraph = JSON.stringify(parseModules(file))
    return ` (function(graph) {
    function require(file) {
        function absRequire(relPath) {
            return require(graph[file].deps[relPath])
        }
        var exports = {};
        (function(require, exports, code) {
            eval(code)
        })(absRequire, exports, graph[file].code)
        return exports
    }
    require('${file}')
})(${depsGraph})`
}
const content = bundle('./src/index.js')

fs.mkdirSync('./dist'); //创建导出文件夹
fs.writeFileSync('./dist/bundle.js', content) //导出代码