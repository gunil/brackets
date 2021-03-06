/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*
 * The timing function canvas and editing code was adapted from Lea Verou's cubic-bezier project:
 * - https://github.com/LeaVerou/cubic-bezier (cubic-bezier.com)
 * 
 * The canvas exceeds the top and bottom of main grid so y-value of points can be
 * dragged outside of the 0-1 range.
 * 
 *   . . . . . .
 *   .         .
 *   +---------+
 *   |         |
 *   |         |
 *   |         |
 *   |         |
 *   +---------+ <-- main grid has height of 150
 *   .         .
 *   . . . . . . <-- canvas has height of 300 (extra 75 above/below)
 * 
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true,  regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, Mustache */

define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var EditorManager       = brackets.getModule("editor/EditorManager"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        Strings             = brackets.getModule("strings"),

        InlineTimingFunctionEditor = require("InlineTimingFunctionEditor").InlineTimingFunctionEditor,
        TimingFunctionUtils        = require("TimingFunctionUtils"),
        Localized               = require("text!Localized.css");

    
    // Functions


    /**
     * Prepare hostEditor for an InlineTimingFunctionEditor at pos if possible.
     * Return editor context if so; otherwise null.
     *
     * @param {Editor} hostEditor
     * @param {{line:Number, ch:Number}} pos
     * @return {?{color:String, start:TextMarker, end:TextMarker}}
     */
    function prepareEditorForProvider(hostEditor, pos) {
        var cursorLine, sel, startPos, endPos, startBookmark, endBookmark, currentMatch,
            cm = hostEditor._codeMirror;

        sel = hostEditor.getSelection();
        if (sel.start.line !== sel.end.line) {
            return null;
        }
        
        cursorLine = hostEditor.document.getLine(pos.line);
        
        // code runs several matches complicated patterns, multiple times, so
        // first do a quick, simple check to see make sure we may have a match
        if (!cursorLine.match(/cubic-bezier|linear|ease/)) {
            return null;
        }

        currentMatch = TimingFunctionUtils.bezierCurveMatch(cursorLine, false);
        if (!currentMatch) {
            return null;
        }
        
        // check for subsequent matches, and use first match after pos
        var lineOffset = 0;
        while (pos.ch > (currentMatch.index + currentMatch[0].length + lineOffset)) {
            var restOfLine = cursorLine.substring(currentMatch.index + currentMatch[0].length + lineOffset),
                newMatch = TimingFunctionUtils.bezierCurveMatch(restOfLine, false);

            if (newMatch) {
                lineOffset += (currentMatch.index + currentMatch[0].length);
                currentMatch = $.extend(true, [], newMatch);
            } else {
                break;
            }
        }

        currentMatch.lineOffset = lineOffset;

        startPos = {line: pos.line, ch: lineOffset + currentMatch.index};
        endPos   = {line: pos.line, ch: lineOffset + currentMatch.index + currentMatch[0].length};
        
        startBookmark = cm.setBookmark(startPos);
        endBookmark   = cm.setBookmark(endPos);
        
        // Adjust selection to the match so that the inline editor won't
        // get dismissed while we're updating the timing function.
        hostEditor.setSelection(startPos, endPos);
        
        return {
            timingFunction: currentMatch,
            start: startBookmark,
            end: endBookmark
        };
    }
    
    /**
     * Registered as an inline editor provider: creates an InlineTimingFunctionEditor
     * when the cursor is on a timing function value.
     *
     * @param {!Editor} hostEditor
     * @param {!{line:Number, ch:Number}} pos
     * @return {?$.Promise} synchronously resolved with an InlineWidget, or null if there's
     *      no color at pos.
     */
    function inlineTimingFunctionEditorProvider(hostEditor, pos) {
        var context = prepareEditorForProvider(hostEditor, pos),
            inlineTimingFunctionEditor,
            result;
        
        if (!context) {
            return null;
        } else {
            inlineTimingFunctionEditor = new InlineTimingFunctionEditor(context.timingFunction, context.start, context.end);
            inlineTimingFunctionEditor.load(hostEditor);
    
            result = new $.Deferred();
            result.resolve(inlineTimingFunctionEditor);
            return result.promise();
        }
    }
    
    /**
     * Initialization code
     */
    function init() {
        // Load our stylesheet
        ExtensionUtils.loadStyleSheet(module, "main.css");
        ExtensionUtils.addEmbeddedStyleSheet(Mustache.render(Localized, Strings));
    
        EditorManager.registerInlineEditProvider(inlineTimingFunctionEditorProvider);
    }

    init();

    // for use by other InlineColorEditors
    exports.prepareEditorForProvider = prepareEditorForProvider;
    
    // for unit tests only
    exports.inlineTimingFunctionEditorProvider = inlineTimingFunctionEditorProvider;
});
