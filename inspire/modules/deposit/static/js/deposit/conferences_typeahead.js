/*
 * This file is part of INSPIRE.
 * Copyright (C) 2014 CERN.
 *
 * INSPIRE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * INSPIRE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with INSPIRE. If not, see <http://www.gnu.org/licenses/>.
 *
 * In applying this licence, CERN does not waive the privileges and immunities
 * granted to it by virtue of its status as an Intergovernmental Organization
 * or submit itself to any jurisdiction.
 */

define(function(require, exports, module) {

  var $ = require('jquery');
  var Bloodhound = require('typeahead');
  var jQueryPlugin = require('js/jquery_plugin');

    /**
     * Constructor.
     *
     * @param element html element on which the plugin
     * @param options dictionary
     * @constructor
     */
    function ConferencesTypeahead(element, options) {

      this.$element = $(element);
      this.options = $.extend({}, $.fn.conferencesTypeahead.defaults, options);

      // often an object, a value chosen from suggestions
      this.value = this.$element.val();
      // lastly typed string
      this.cachedQuery = this.$element.val();

      this.suggestionTemplate = this.options.suggestionTemplate;
      this.selectedValueTemplate = this.options.selectedValueTemplate;

      var that = this;

      this.engine = new Bloodhound({
        name: 'conferences',
        remote: '/search?cc=Conferences&p=%QUERY*&of=recjson&f=conferences',
        datumTokenizer: function(datum) {
          return that.datumTokenizer.call(that, datum);
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        limit: 100,
      });

      this.engine.initialize();

      this.$element.typeahead({
        minLength: this.options.minLength
      }, {
        // after typeahead upgrade to 0.11 can be substituted with:
        // source: this.engine.ttAdapter(),
        // https://github.com/twitter/typeahead.js/issues/166
        source: function(query, callback) {
          // trigger can be deleted after typeahead upgrade to 0.11
          this.$element.trigger('typeahead:asyncrequest');
          this.engine.get(query, function(suggestions) {
            this.$element.trigger('typeahead:asyncreceive');
            callback(suggestions);
          }.bind(this));
        }.bind(this),
        // the key of a value which is rather passed to typeahead than displayed
        // the display values are selected by templates.
        displayKey: 'conference',
        templates: {
          empty: function(data) {
            return that.options.cannotFindMessage;
          },
          suggestion: function(data) {
            return that.suggestionTemplate.render.call(that.suggestionTemplate, data.conference);
          }
        }
      });

      this.ttTypeahead = this.$element.data("ttTypeahead");

      // saves overwritten functions
      this.orgTypeahead = {
        setInputValue: that.ttTypeahead.input.setInputValue,
      };

      this.ttTypeahead.input.setInputValue = function(value, silent) {
        return that.setInputFieldValue.apply(that, [value, silent]);
      };
    }

    ConferencesTypeahead.prototype = {

      /**
       * Connects events to functions.
       */
      connectEvents: function connectEvents() {
        var that = this;

        this.ttTypeahead.input.$input.on("keydown", function(event) {
          return that.onKeydown(event);
        });
        this.ttTypeahead.input.onSync("queryChanged", function(event, query) {
          that.cachedQuery = query;
        });
      },

      /**
       * A function which overwrites typeahead's setInputFieldValue(), shows a description
       * of a autocompleted value.
       *
       * @param value value to set - from typeahead
       */
      setInputFieldValue: function setInputFieldValue(value, silent) {
        if (Array.isArray(value)) {
          this.value = value[0];
        } else {
          this.value = value;
        }
        this.ttTypeahead.input.setQuery(this.value);
        var renderedValue = this.getUserFriendlyValue();
        this.orgTypeahead.setInputValue.call(
          this.ttTypeahead.input, renderedValue, silent);
      },

      /**
       * Removes non alpha-numeric characters from beginning and end of a string.
       *
       * @param str {String} input string
       * @returns {String} trimmed string
       * @private
       */
      _trimNonAlphaNumericChar: function _trimNonAlphaNumericChar(str) {
        return str.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/ig, '');
      },

      /**
       * Tokenizer used by the bloodhound engine
       *
       * @param datum {Object} an item returned by query
       * @returns {Array} array of tokens; the result query is a one consisting of queries
       *   for every token connected with OR operator
       */
      datumTokenizer: function datumTokenizer(datum) {
        if ((typeof datum) === 'string' || !datum.conference) {
          return [datum];
        }
        var tokens = [];
        datum = datum.conference;
        if (datum.date && (typeof datum.date) === 'string') {
          tokens = tokens.concat(datum.date.split(/\.?\s+-?\s*/));
        }
        if (datum.title && (typeof datum.title) === 'string') {
          var titleNameTokens = datum.title.split(/\s+/);
          titleNameTokens = $.map(titleNameTokens, this._trimNonAlphaNumericChar);
          tokens = tokens.concat(titleNameTokens);
        }
        if (datum.place && (typeof datum.place) === 'string') {
          tokens = tokens.concat(datum.place.split(/,?\s+/));
        }
        if (datum.conference_id && (typeof datum.conference_id) === 'string') {
          tokens.push(datum.conference_id);
        }
        return tokens;
      },

      /**
       * Returns value of the field which identifies the chosen suggestion,
       * not the description shown to a user.
       *
       * @returns {String}
       */
      getRawValue: function getRawValue() {
        if (this.isFieldValueAutocompleted() && this.value.conference_id) {
          return this.value.conference_id;
        }
        return '';
      },

      /**
       * Initialize value from rawValue which is compared to conference id.
       * @param rawValue {String}
       *  more than one dataset set for twitter typeahead, otherwise should be
       *  set to 0 to use the only one.
       */
      initFromRawValue: function(rawValue) {
        this.engine.get(rawValue, function(suggestions) {
          var suggestion;
          $.each(suggestions, function(idx, item) {
            if (item.conference.conference_id === rawValue) {
              suggestion = item.conference;
              return false;
            }
          });
          if (!suggestion) {
            return;
          }
          this.cachedQuery = rawValue;
          this.setInputFieldValue(suggestion, true);
        }.bind(this));
      },

      /**
       * Description of an autocompleted value.
       *
       * @returns {String}
       */
      getUserFriendlyValue: function getUserFriendlyValue() {
        if (this.isFieldValueAutocompleted()) {
          return this.selectedValueTemplate.render(this.value);
        }
        return this.value;
      },

      /**
       * Checks if the field is value is the autocompletition result or just
       * a string typed by a user
       *
       * @returns {bool}
       */
      isFieldValueAutocompleted: function isFieldValueAutocompleted() {
        return (typeof this.value) === 'object';
      },

      /**
       * Handles keydown event. Should block changing the field value
       * as long as there is an autocompleted value. This prevents a crash
       * on typeahead's normalizeQuery() which accepts a string only.
       *
       * @param event {Event} keydown event
       */
      onKeydown: function onKeydown(event) {
        if (this.isFieldValueAutocompleted()) {
          var keyCode = event.which || event.keyCode;
          var isAlphaNumericKey = (
            (keyCode >= 48 && keyCode <= 57) || // numbers
            (keyCode >= 96 && keyCode <= 105) || // numpad
            (keyCode >= 65 && keyCode <= 90) || // letters
            (keyCode >= 186 && keyCode <= 192) || // symbols
            (keyCode >= 219 && keyCode <= 222) // symbols
          );
          // backspace or delete
          var doesDeleteAChar = (keyCode === 8 || keyCode === 46);
          // reset to empty
          if(this.ttTypeahead.dropdown.isVisible()) {
            if (doesDeleteAChar) {
              // if the field stores autocompletion result reset it to query
              this.resetToCachedQuery();
              // update dropdown
              this.ttTypeahead
                ._onQueryChanged('queryChanged', this.ttTypeahead.input.query);
            }
            // for both alfanumeric/symbol keys and delete/backspace
            // block passing the key to the field
            return false;
          } else if (doesDeleteAChar || isAlphaNumericKey) { // not visible
            this.ttTypeahead.input.query = '';
            this.ttTypeahead.input.resetInputValue();
            this.ttTypeahead
              ._onQueryChanged('queryChanged', this.ttTypeahead.input.query);
            // pass only characters, the code for delete is above
            return isAlphaNumericKey;
          }
        }
        return true;
      },

      /**
       * Resets input field value to what was lastly typed in.
       */
      resetToCachedQuery: function resetToCachedQuery() {
        this.ttTypeahead.input.query = this.cachedQuery;
        this.ttTypeahead.input.resetInputValue();
      },
    };

    $.fn.conferencesTypeahead = jQueryPlugin(ConferencesTypeahead, 'conferences-typeahead');

    $.fn.conferencesTypeahead.defaults = {
      /**
       * @param {Hogan template} a template used to render a suggestion
       */
      suggestionTemplate: {},
      /**
       * @param {Hogan template} a template used to render a the descriptive field value
       */
      selectedValueTemplate: {},
      /**
       * @param {String} a message shown when no suggestion is available
       */
      cannotFindMessage: undefined,
      /**
       * @type Integer number of characters after which suggestions start to
       *  be fetched
       */
      minLength: 3,
    };

  module.exports = ConferencesTypeahead;
});
