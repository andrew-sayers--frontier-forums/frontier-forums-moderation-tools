BabelExt.utils.dispatch(

    /*
     * Add links to Moderated Posts page
     */
    {
        callback: function(stash) {
            $(function(){$('img[src="images/misc/moderated.gif"],img[src="images/misc/moderated_small.gif"]').wrap('<a href="http://forums.frontier.co.uk/modcp/moderate.php?do=posts"></a>')});

            var callback_created = 0;
            stash.check_on_stopforumspam = function(url) {
                if ( !callback_created++ )
                    BabelExt.utils.runInEmbeddedPage(
                        'window.stop_forum_spam_callback = ' +
                            function stop_forum_spam_callback(data) {
                                var response = [];
                                if ( data.success ) {
                                    switch ( data.username.frequency ) {
                                    case 0: response.push('username does not appear in the list'); break;
                                    case 1: response.push('username appears once in the list'); break;
                                    default: response.push('username appears ' + data.username.frequency + ' times in the list'); break;
                                    }
                                    switch ( data.ip.frequency ) {
                                    case 0: response.push('IP address does not appear in the list'); break;
                                    case 1: response.push('IP address appears once in the list'); break;
                                    default: response.push('IP address appears ' + data.ip.frequency + ' times in the list'); break;
                                    }
                                } else {
                                    response.push('Could not contact server');
                                }
                                alert(response.join("\n"));
                            }
                    );
                $.ajax({ url: url, dataType: "jsonp", jsonpCallback: 'stop_forum_spam_callback' });
            }

        }
    },

    /*
     * CROSS-PAGE ACTIONS
     *
     * Sometimes it's useful to perform an action based on the page you just came from
     * (e.g. reviewing a post after creating it)
     *
     * To create a new cross-page action:
     *
     * 1. Add it to the 'cross_page_actions' hash below
     * 2. Optionally add a cross_page_failure action to fire if the normal action doesn't fire
     * 3. call on_next_page( 'action_name', arg1, arg2, arg3 ), where the arguments will be passed to your action
     *
     */
    {
        pass_storage: ['cross_page_data'],
        callback: function( stash, pathname, params, cross_page_data ) {

            if ( params.hasOwnProperty('u') ) stash.user_id = params.u;

            var
                cross_page_actions = {

                    copy_to_user_note: function( text, title, security_token ) {
                        $.ajax({
                            type: "POST",
                            url: 'http://forums.frontier.co.uk/usernote.php',
                            data: {
                                'do'           : 'donote',
                                'message'      : text,
                                'parseurl'     : 1,
                                'title'        : title,
                                'u'            : user_id,
                                'securitytoken': security_token
                            },
                            error: function() {
                                alert('Could not copy PM to user note - please copy it over manually.');
                            }
                        });
                    },

                    set_user_id: function( user_id ) { if (!stash.user_id) stash.user_id = user_id; },
                    check_user_note_checkbox: function() { stash.check_user_note_checkbox = true; }

                },
                cross_page_failure_actions = {
                    copy_to_user_note: function() { alert( 'Failed to copy message to user note - please copy it manually.' ); },
                }
            ;

            cross_paga_data = $.grep(JSON.parse( cross_page_data || '[]' ), function(datum) {
                if ( (new Date()).getTime() < cross_page_datum.time ) {
                    if ( document.referrer && document.referrer == cross_page_datum.referrer ) {
                        cross_page_actions[cross_page_datum.action].apply( this, cross_page_datum.args );
                        return false;
                    }
                } else {
                    if ( cross_page_failure_actions[cross_page_datum.action] )
                        cross_page_failure_actions[cross_page_datum.action]();
                    return false;
                }
                return true;
            });
            BabelExt.storage.set( 'cross_page_data', JSON.stringify(cross_page_data) );

            function on_next_page( action ) {
                cross_page_data.push({
                    referrer: window.location.toString(),
                    time    : new Date().getTime() + 10000,
                    action  : action,
                    args    : Array.prototype.slice.call(arguments, 1),
                });
                BabelExt.storage.set({ cross_page_data: JSON.stringify(cross_page_data) });
            }

            stash.copy_to_user_note = function(check) {
                $('#vB_Editor_001_save').closest('form').submit(function() {
                    on_next_page( 'set_user_id', user_id );
                    if ( $('#copy_to_user_note').prop('checked') ) {
                        on_next_page( 'check_user_note_checkbox' );
                        if ( !$("input[name=preview]:focus", this).length )
                            on_next_page( 'copy_to_user_note', $('#vB_Editor_001_textarea').val(), $('[name=title],[name=note]').val(), $('input[name="securitytoken"]').val() );
                    }
                });
                $('#copy_to_user_note').prop( 'checked', stash.check_user_note_checkbox || check || false );
            }

        }
    },

    { // retrieve the wathchlist
        match_pathname: '/showthread.php',
        pass_storage: [ 'watched_users', 'watched_users_timestamp' ],
        callback: function( stash, pathname, params, watched_users, watched_users_timestamp ) {
            stash.watchlist_html = '<a href="http://forums.frontier.co.uk/showthread.php?t=10650"><img title="user is on the watch list" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAKCAQAAAAXtxYXAAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfeCQgAIRS6AVz/AAAA+ElEQVQY002Pv23CQBxG3yWWbATmzEF5/DkhUaSxNzAbMIK9ASOYEdgANjCZADZwaNJmBJMuFrZ+KaxIea96xVd8CgBiTa5ylfQlH3LmfP8GUABvO3VWEXBTN5AtW5CH5J/v8AKbU3dpo/bYRc2hSZqkOXRRe2yj7rI5Aa5w4up1CqvUSe8qhXXqaieuwIqtFzGALazMy3lpxRYAi9jWVrwnICvu8ARIANQD4CdSANPMiJHJHmbafBkxYqqZhsneiJFpBoyzUEIZXYdLrXWqU62Hy9E1lLAeZ/1tBnFQBRKIX/mFX/hVIIEE1SDmP17mla/S65Xe35ZfppZeW0ULI8kAAAAASUVORK5CYII=" style="margin-right: 0.5ex">user is on the watchlist</a>';
            stash.watched_users = JSON.parse( watched_users || '{}' );
            stash.watched_users_timestamp = parseInt( watched_users_timestamp || '0', 10 );

            if ( stash.watched_users_timestamp < new Date().getTime() ) {
                $.ajax({
                    url: 'http://forums.frontier.co.uk/showpost.php?p=246029&postcount=1',
                    dataType: "html",
                    success: function( msg ) {
                        stash.watched_users = {};
                        $(msg).find( '#post_message_246029 a[href^="http://forums.frontier.co.uk/search.php?do=finduser&u="]' )
                            .each(function() {
                                stash.watched_users[this.href.substr(54)] = 1;
                            });
                        BabelExt.storage.set( 'watched_users', JSON.stringify( stash.watched_users ) );
                        BabelExt.storage.set( 'watched_users_timestamp', new Date().getTime() + 60*60*1000 );
                    }
                });
            }

        }
    },

    /*
     * TEMPLATE DATA
     *
     * Moderators have to send a lot of similar posts, so defining templates makes life a lot easier:
     */
    {
        pass_storage: [ 'template_post_overrides' ],
        callback: function( stash, pathname, params, template_post_overrides ) {
            var next_week = new Date();
            next_week.setDate(next_week.getDate()+7);

            var rule_header = '[QUOTE=Forum Rules;421867]',
                rule_footer = '[/QUOTE]',
                things_you_agree_to_not_do = "[b]You agree to not:[/b]\n[LIST][*]Be insulting to any person via obscene, offensive, hateful or inflammatory comments via the means of private messages, public messages and visitor messages in order to bait, harass, and lure other users into responding. This is also known as trolling or flame-baiting.\n[*]Derail an ongoing discussion topic, forcing it to another type of discussion.\n[*]Use sexually explicit or harmful language including the use of misspelled or punctuated words to insinuate, represent any of the above - also known as \"masked swearing\". This includes words that are blocked by the automatic filter, swearing is not allowed in posts.\n[*]Utilize symbols or other non-normal ASCII English letters to mask out a swear word. If a word is filtered, then it's filtered, don't evade it.\n[*]Partake in personal arguments with other members of the community on the forums. If you have problems with other members either resolve your issues in private via PM or email, or use the \"Ignore\" feature of the bulletin board system in order to ignore that person.\n[*]Promote discrimination based on race, sex, religion, nationality, disability, sexual orientation, age or other criteria that offends other users.\n[*]Use the discussion board features to call out individuals or groups in thread titles, polls and/or posts to simply demean or insult them. Commonly known as bandwagoning. \n[/LIST]",
                general_advice =
                    "To check a post before it goes live, click the [i]Preview Post[/i] button on the post page or the [i]Go Advanced[/i] button in the quick reply box.  If you don't spot a problem until your post is live, you can remove it with the [i]edit[/i] button.  " +
                    "[post=<<POST_ID>>]Your message[/post] has now been edited to comply with forum rules, and you can see the changes on [URL=\"http://forums.frontier.co.uk/posthistory.php?p=<<POST_ID>>\"]its \"last edited\" page[/URL].  If you re-edit the post to avoid the problem altogether, please notify us by replying to this message.  That way we know you're just tidying up, not trying to avoid moderation.\n\n" +
                    "For your reference, the relevant forum rules are quoted below.\n\n",
                problem_rules = {
                    'Abuse of post/content reporting system': rule_header + things_you_agree_to_not_do + rule_footer,
                    'Avatar Rule Violation': rule_header + '[B]Compliant Avatars and Signatures[/B]\n[INDENT]Avatars and signatures must adhere to the same rules as written posts. Do not use anything that may be construed as offensive, inflammatory, or illegal.\nThe current dimensions allowed are 80x80 pixels for avatars, and up to 650x150 pixels for signatures. Please refrain from including links to paid-for-services and advertising within your signature. Links within signatures should be reserved for personal links. Images in signatures that are larger than 650 pixels wide and 150 pixels tall will result in the removal of the image, coupled along with a private message notification and/or warning.[/INDENT]' + rule_footer,
                    'Divulged Personal Details': rule_header + '[B]Do Not Divulge Personal Details[/B]\n[INDENT]You agree to not disclose names, addresses, telephones, mobile or fax numbers, email addresses or any other personally identifiable data of any individual. We request for your safety that you do not post sensitive information about yourself or others on these forums.[/INDENT]' + rule_footer,
                    'Going off-topic/spamming': rule_header + "[B]Off-topic[/B]\n[INDENT]Going off-topic in an ongoing, on-topic discussion is defined as talking about something completely unrelated to the ongoing discussion or debate within the thread. Off-topic also includes replies created to topics for the sole purpose of ganging up on other members or groups of users. [/INDENT]\n\n[b]Thread hijacking[/b][INDENT]Hijacking a threads discussion will result in your posts and other posts that participated in the hijacking to be moderated. Continuous thread hijackings will result in moderation of your posting privileges on the Frontier forums. Hijacking threads is not limited to you injecting an off-topic opinion to a discussion, posting about politics, comparing objects/people/things to political objects and/or attempting to harass another member or group of members.[/INDENT]\n\n[B]No Spam[/B]\n[INDENT]No \"spam\" on the forums. Spamming is defined as the abuse of systems to post unnecessary or irrelevant messages, or non-contributing postings. This includes, but isn't limited to posting multiple copies of the same thread across various forums or cross-posting the same comments in multiple threads in order to get your comments noticed. [/INDENT]" + rule_footer,
                    'Image Spamming': rule_header + "[B]No Spam[/B]\n[INDENT]No \"spam\" on the forums. Spamming is defined as the abuse of systems to post unnecessary or irrelevant messages, or non-contributing postings. This includes, but isn't limited to posting multiple copies of the same thread across various forums or cross-posting the same comments in multiple threads in order to get your comments noticed. [/INDENT]" + rule_footer,
                    'Inappropriate Language' : rule_header + "[B]No Abuse or Disrespectful Behaviour[/B]\nThe following forum rules are in place to promote the Frontier forums as a safe, friendly and welcoming place for the community. Discussions and debates are greatly welcomed. However, not at the expense of common sense and decency, as exemplified by the rules below.\n\n" + things_you_agree_to_not_do + rule_footer,
                    'Inflammatory / baiting posts': rule_header + things_you_agree_to_not_do + rule_footer,
                    'Insubordination/Moderator Contestment': rule_header + "[b]Insubordination[/b]\n[indent]If you disagree with a moderator's course of action over an incident, whether that be the closing of a thread or the issuing of an infraction, you must contact a member of the moderation team privately (through private message) to voice your grievance(s), complaint(s), and/or concern(s). It is not acceptable to do this in a public discussion medium. Any attempt to do so will be seen as an attempt to undermine the moderation team and will result in an infraction and removal of the content posted. If you disagree with a moderator's decision it is also not acceptable to verbally abuse or harass them, either through the forum or any other form of communication. Any attempt to do so may result in a complete termination of your account from the forums.[/indent]" + rule_footer,
                    'Insulted Other Member(s)': rule_header + things_you_agree_to_not_do + rule_footer,
                    'Moderator/Employee Harassment': rule_header + "[b]Insubordination[/b][indent]If you disagree with a moderator's course of action over an incident, whether that be the closing of a thread or the issuing of an infraction, you must contact a member of the moderation team privately (through private message) to voice your grievance(s), complaint(s), and/or concern(s). It is not acceptable to do this in a public discussion medium. Any attempt to do so will be seen as an attempt to undermine the moderation team and will result in an infraction and removal of the content posted. If you disagree with a moderator's decision it is also not acceptable to verbally abuse or harass them, either through the forum or any other form of communication. Any attempt to do so may result in a complete termination of your account from the forums.[/indent]\n\n" + things_you_agree_to_not_do + rule_footer,
                    'Naming and Shaming': rule_header + "[B]No Naming and Shaming.[/B]\n[INDENT]We do not allow \"naming and shaming\" discussions, or types of content deemed naming and shaming on the Frontier discussion board. Naming and Shaming is the act of publicly naming someone and ridiculing or accusing them of something. This also includes putting names on a blacklist in your signature or thread. [/indent]\n\n[b]No witch-hunts/mob-mentality hunts[/b]\n[INDENT]We do not permit the Frontier forums to be used for 'witch-hunts' or mob-mentality griefing. This is essentially the inverse of naming and shaming where people will try to bait others into ratting people out.[/INDENT]" + rule_footer,
                    'Private Messaging Abuse': rule_header + "[B]Keep Private Communications Private[/B]\n[INDENT]You agree to not post private messages or emails between forum users, moderators or Frontier staff on the forums without the consent of the sender(s). [/INDENT]\n\n" + things_you_agree_to_not_do + rule_footer,
                    'Reputation Abuse': rule_header + things_you_agree_to_not_do + rule_footer,
                    'Role Play Abuse': rule_header + things_you_agree_to_not_do + rule_footer,
                    'Signature Rule Violation': rule_header + "[B]SIGNATURE RULES AND LIMITATIONS[/B]\n\n[LIST]\n[*]Maximum image file size limit limited to 250KB.\n[*] Maximum allowed images per user signature is one.\n[*]Animated images (eg: gif image or banner rotators) are [I]not[/I] allowed.\n[*][B]Maximum width[/B] of an image is 650 pixels.\n[*][B]Maximum height[/B] of an image is 150 pixels.\n[*]Maximum allowed lines of normal sized text per signature is [B]five[/B]. \n[*]If text lines are added to a sig they cannot be made larger than the default size.\n[*]Lines are not allowed to wrap else they count as additional lines\n[LIST]\n[*]If an image is added to a signature, and the image is up to 650x150, maximum lines permitted is zero\n[*]If an image is added to a signature, and the image is up to 650x120, maximum lines permitted is one\n[*]If an image is added to a signature, and the image is up to 650x90, maximum lines permitted is two\n[*]If NO image is added to a signature, maximum lines of text permitted is five.\n[*]Quote, code, and/or special bbcode that consumes lines of text, count as two lines each.\n[*]Links do not count as special bbcodes but must adhere to the links rules\n[*]Empty lines of text count as a line / additional line to a signature.\n[/LIST]\n[/LIST]" + rule_footer,
                    'Spammed Advertisements': rule_header + "[B]Zero Tolerance Policy on Offensive, Pornography and/or other Illegal/Malicious Content[/B]\n[INDENT]You agree to not post offensive material or post links, information or advert that illustrate illegal activity (including without limitation the posting or promoting of illegal software or media, be it television or software piracy) or lead to malicious sites/files. [i]Any posts of content with pornographic, fraudulent, phishing or warez material will skip the three-strike warnings.[/i]\n\n" + things_you_agree_to_not_do + rule_footer,
                    'Swear Filter Evasion': rule_header + things_you_agree_to_not_do + rule_footer,
                    'User Impersonation': rule_header + "[B]Do Not Impersonate Another User[/B]\n[INDENT]You are expressly forbidden from impersonating another forum user, moderator, administrator, Frontier employee or any of Frontier's partners. You will not give the impression that a thread or comment emanates from any of the listed. Means of impersonation could include the usage of avatars, profile pictures, signatures, posts/polls, and/or thread prefixes that mimic or appear to be 'officially posted'. [/INDENT]" + rule_footer,
                    'Visitor Messaging Abuse': rule_header + things_you_agree_to_not_do + rule_footer
                },
                template_replacements = {
                    PM_HEADER        : "Hi.",
                    PM_FOOTER        : "Best regards,\nFrontier Moderation Team.",
                    PROBLEM          : params['problem'] || '<<PROBLEM>>',
                    POST_ID          : params['post_id'] || params['p'] || '<<POST_ID>>',
                    STATUS           : params.status || '<<STATUS>>',
                    'NEXT WEEK'      : next_week.toGMTString().replace(/:[0-9][0-9] /, ' ' ),
                    'SIGNATURE RULES': problem_rules['Signature Rule Violation'],
                    'LANGUAGE RULES' : problem_rules['Inappropriate Language'  ],
                    'PROBLEM RULES'  : '<<PROBLEM RULES>>',
                },
                template_posts = [ // we use an array here to control the order they're displayed in
                    {
                        id: 'bad_signature',
                        title: 'Please bring your signature into line with forum rules',
                        body: "<<PM_HEADER>>\n\nThis is a friendly request to bring your signature in line with the forum rules.  Your signature has <<PROBLEM>> - could you modify it to comply with the rules quoted below?\n\n<<SIGNATURE RULES>>\n\nPlease modify your signature within 7 days (i.e. by <<NEXT WEEK>>) - we're required to issue an official warning if it's still in violation after that time.\n\n<<PM_FOOTER>>",
                        copy_to_user_note: 1
                    },

                    {
                        id: 'masked_swearing',
                        title: 'Please avoid inappropriate language',
                        body: "<<PM_HEADER>>\n\n" +
                            "This is a friendly reminder that you should rephrase sentences to avoid the need for filtered words, instead of leaving words masked or trying to work around the filter.  Filtered words have been used so frequently in bad ways that we have to disallow them regardless of context - your use of language may seem reasonable to you, but the moderation team no longer has the luxury of judging on a case-by-case basis.\n\n" +
                            general_advice +
                            "<<LANGUAGE RULES>>\n\n" +
                            "<<PM_FOOTER>>",
                        copy_to_user_note: 1
                    },

                    {
                        id: 'report_take',
                        title: "I'm on it",
                        body: "I'm on it"
                    },

                    {
                        id: 'report_update',
                        title: "Update",
                        body: 'Current action:\n\n[list]\n[*]\n[*]updated user notes\n[/list]\n\nCurrent status: <<STATUS>>'
                    },
                    {
                        id: 'infraction',
                        title: '<<PROBLEM>>',
                        body: 'You are being issued an <<INFRACTION TYPE>> for <<PROBLEM NAME>>.  We welcome all sorts of discussions on the Frontier forums, but we do not allow <<PROBLEM NAME>> so [post=<<POST_ID>>]your message[/post] has been edited.\n\n'+general_advice+'<<PROBLEM RULES>>'
                    }

                ]
            ;

            var template_post_overrides = JSON.parse( template_post_overrides || '{}' );
            Object.keys(template_post_overrides).forEach(function(key) {
                template_posts[key].title = override_posts[key].title;
                template_posts[key].body  = override_posts[key].body ;
            });

            stash.template_posts = template_posts;
            stash.problem_rules = problem_rules;

            stash.replace_template_text = function(text, extra_replacements) {
                if ( !extra_replacements ) extra_replacements = {};
                return text.replace( /<<(.*?)>>/g, function(match,key) {
                    if      (    extra_replacements.hasOwnProperty(key) ) return    extra_replacements[key];
                    else if ( template_replacements.hasOwnProperty(key) ) return template_replacements[key];
                    else                                                  return '<<'+key+'>>';
                });
            }

            stash.save_template_post = function(post) {
                template_post_overrides[post.id] = post;
                BabelExt.storage.set( 'template_post_overrides', JSON.stringify(template_post_overrides) );
            };

        }
    },

    {
        match_pathname: ['/showthread.php'],
        callback: function() {
            // When reporting a post, go straight to the reports forum:
            if ( document.referrer.search('/report.php') != -1 ) {
                document.location = 'http://forums.frontier.co.uk/forumdisplay.php?f=48';
                return false;
            }
        }
    },

    /*
     * EDIT POST PAGES
     */
    {
        match_pathname: ['/editpost.php'],
        match_elements: ['[name="deletepost"]'],
        callback: function(stash, pathname, params, deletepost) {

            $(deletepost).on( 'change', function() {
                if ( $('#rb_del_leave').prop('checked') ) {
                    $('#vB_Editor_001_save')
                        .prop( 'disabled', false )
                        .removeAttr( 'title' );
                    $('#collapseobj_editpost_delete [type=submit]')
                        .prop( 'disabled', true )
                        .attr( 'title', 'Check a "delete" checkbox' );
                } else {
                    $('#vB_Editor_001_save')
                        .prop( 'disabled', true )
                        .attr( 'title', 'Check the "do not delete" checkbox' );
                    $('#collapseobj_editpost_delete [type=submit]')
                        .prop( 'disabled', false )
                        .removeAttr( 'title' );
                }
            })
                .change();

            $('<br><label><input type="checkbox">I have confirmed with other moderators that this post can be physically removed from our servers</label>')
                .insertAfter( $('#rb_del_hard').prop( 'disabled', true ).parent() )
                .find('input')
                .click(function() {
                    $('#rb_del_hard').prop( 'disabled', !$(this).prop('checked') )
                });

        }

    },

    {
        match_pathname: ['/editpost.php'],
        match_elements: ['[name=vbform] [name=reason]'],
        match_params: {
            'edit-reason': true,
        },
        callback: function(stash, pathname, params, reason) {
            reason.value = params['edit-reason'];
        }
    },

    /*
     * POST TEMPLATES
     */
    {
        match_pathname: ['/private.php','/newreply.php'],
        match_elements: ['table.fieldset','#cb_openclose'],
        callback: function(stash, pathname, params, fieldset, openclose) {
            /*
             * ADD ELEMENTS TO FORM
             */
            var select_box = $('<select><option value="">Pick a template</option></select>').insertBefore(fieldset),
                edit_box = $('<form style="display: none; position: fixed; width: 40em; margin-left: -20em; margin-top: -12em; left: 50%; top: 50%; border: 2px solid black; background: #cde; padding: 1em"><input type="hidden" name="id"><input style="width: 99%" name="new_title"><textarea style="width: 99%; height: 20em" name="new_body"></textarea><br><input type="submit" value="OK"><input type="submit" value="Cancel"><a style="color: blue; float: right" target="_blank" href="http://forums.frontier.co.uk/showthread.php?t=34869">see more templates</a></form>').prependTo(document.body)
            ;
            edit_box.submit(function(event) {
                if ( !$("input[value=Cancel]:focus", this).length ) {
                    stash.save_template_post({
                        id: $('[name=id]',this).val(),
                        title: $('[name=new_title]',this).val(),
                        body : $('[name=new_body]' ,this).val()
                    });
                }
                $(this).hide();
                event.preventDefault();
            });
            select_box.change(function() {
                var selected = select_box.find(':selected');
                $('[name=title]'      ).val (                                  selected.text()                             );
                $('#copy_to_user_note').prop('checked',                        selected.data('copy_to_user_note') || false );
                $('#vB_Editor_001_textarea').val( stash.replace_template_text( selected.val() )                            );
            });

            if ( stash.user_id ) { // copy to user_note
                select_box.after( '<label style="display: block"><input type="checkbox" id="copy_to_user_note">Copy message to user note for user ' + stash.user_id + '</label>' );
                stash.copy_to_user_note();
            }
            $( '<a style="color: blue" href="#edit_template">edit template</a>' )
                .insertAfter(select_box)
                .click(function() {
                    if ( select_box.find(':selected').data('id') ) {
                        edit_box.show();
                        edit_box.find( '[name=new_title]' ).val( select_box.find(':selected').text() );
                        edit_box.find( '[name=new_body]'  ).val( select_box.find(':selected').val () );
                        edit_box.find( '[name=id]'        ).val( select_box.find(':selected').data('id') );
                    } else {
                        alert('please pick a template to edit');
                    }
                });

            if ( location.search.search( '&cb_openclose=1' ) != -1 )
                $(openclose).prop('checked', true);

            /*
             * ADD TEMPLATES
             */
            stash.template_posts.forEach(function(template_post) {
                $('<option>').appendTo( select_box )
                    .text( template_post.title )
                    .val( template_post.body )
                    .data( 'id', template_post.id )
                    .data( 'copy_to_user_note', template_post.copy_to_user_note ? true : false )
                ;
            });
            if ( location.search.search( '&template=' + template_post.id ) != -1 )
                select_box.val( template_post.body ).change();

        }
    },

    /*
     * INFRACTION PAGES
     */
    {
        match_pathname: ['/infraction.php'],
        match_elements: ['[name=note]', '#vB_Editor_001_textarea' ],
        callback: function(stash,pathname,params, note, textarea) {

            var problem_names = {
                'Abuse of post/content reporting system': 'abuse of the post/content reporting system',
                'Avatar Rule Violation': 'avatar rule violations',
                'Divulged Personal Details': 'divulging personal details',
                'Going off-topic/spamming': 'going off-topic/spamming',
                'Image Spamming': 'image spamming',
                'Inappropriate Language' : 'inappropriate language',
                'Inflammatory / baiting posts': 'inflammatory / baiting posts',
                'Insubordination/Moderator Contestment': 'insubordination/moderator contestment',
                'Insulted Other Member(s)': 'insulting other member(s)',
                'Moderator/Employee Harassment': 'moderator/employee harassment',
                'Naming and Shaming': 'naming and shaming',
                'Private Messaging Abuse': 'private messaging abuse',
                'Reputation Abuse': 'reputation abuse',
                'Role Play Abuse': 'role play abuse',
                'Signature Rule Violation': 'signature rule violations',
                'Spammed Advertisements': 'advertisement spamming',
                'Swear Filter Evasion': 'swear filter evasion',
                'User Impersonation': 'user impersonation',
                'Visitor Messaging Abuse': 'visitor messaging abuse',
            };

            $(note).after( '<label style="display: block"><input type="checkbox" checked id="copy_to_user_note">Copy message to user note for user ' + stash.user_id + '</label>' );
            stash.copy_to_user_note(true);
            $('input[id^=il_]').click(function() {
                var warning_links = $('input[name^=warning]'),
                    is_checked = ( warning_links.filter(':checked').length ) ? true : false,
                    problem = $(this).closest('label').text(),
                    extra_replacements = {
                        'INFRACTION TYPE': is_checked ? 'official warning' : 'infraction',
                        'PROBLEM': problem,
                        'PROBLEM NAME': problem_names[ problem ],
                        'PROBLEM RULES': stash.problem_rules[ problem ]
                    },
                    template = $.grep(stash.template_posts, function(template) { return template.id == 'infraction' })[0]
                ;
                $(note    ).val( stash.replace_template_text( template['title'], extra_replacements ) );
                $(textarea).val( stash.replace_template_text( template['body' ], extra_replacements ) );
                warning_links.hide().prop( 'checked', false );
                $(this).closest('tr').find('input[name^=warning]').show().prop( 'checked', is_checked );
            });

            if ( params['do'] == 'report' ) {
                $('input[name^=warning]').first().prop( 'checked', true );
                $('input[id^=il_]:checked').click();
            } else {
                $('input[name^=warning]').hide();
                $('input[id^=il_]:checked').closest('tr').find('input[name^=warning]').show();
            }
        }
    },

    /*
     * MEMBER PAGE
     */
    {
        match_pathname: '/member.php',
        match_elements: 'a[href^="moderator.php?do=useroptions&u="]',
        callback: function( stash, pathname, params, a ) {
            $(a).parent().after('<li class="thead"><a href="'+$(a).attr('href').replace('moderator.php?do=useroptions','modcp/user.php?do=reputation')+'">Edit Reputation</a></li>');
        }
    },

    /*
     * MODCP PAGES
     */
    {
        match_pathname: '/modcp/user.php',
        match_elements: '[id="ctrl_options[showreputation]"]',
        callback: function( stash, pathname, params, showreputation ) {
            $(showreputation).closest('tr').siblings().last().after(
                '<tr><td class="alt1"><a href="/modcp/user.php?do=reputation&u='+params.u+'">[Edit reputation]</a><td class="alt1">To delete reputation, <a href="/showgroups.php">Find a willing administrator</a> and PM them the [edit] link for the specific line on the rep page</tr>'
            );
        }
    },
    {
        match_pathname: '/modcp/moderate.php',
        match_elements: '.copyright',
        callback: function(stash) {
            $('a[href^="user.php"]').each(function() {
                $('<a class="stopforumspam" href="http://api.stopforumspam.org/api?username=' + encodeURIComponent($(this).text()) + '&amp;f=json">search on StopForumSpam.com</a>')
                    .insertAfter( $(this).closest('tr').next().next().next().next().next().find('label').last() )
                    .data( 'user-page', this.href )
                    .before(' - ')
                ;
            });
            $('.stopforumspam').click(function(event) {
                var href = this.href;
                $.ajax({
                    type: "GET",
                    url: $(this).data('user-page'),
                    success: function(html) {
                        stash.check_on_stopforumspam( href + '&ip=' + $(html).find('#it_user\\[ipaddress\\]_17').val() );
                    }
                });
                event.preventDefault();
            });
        }
    },

    /*
     * MODERATION TOOLS SECTION ON THREAD PAGES
     */
    {
        match_pathname: '/showthread.php',
        callback: function(stash) {

            stash.report_block = $('<div align="center" style="margin-bottom: 10px"><div class="page"><div align="left"><table width="100%" cellspacing="1" cellpadding="6" border="0" align="center" class="tborder"><thead><tr><td class="thead" style="color: white">Moderation report</td></tr></thead><tbody><tr><td style="color: white">Recent threads in <a href="http://forums.frontier.co.uk/forumdisplay.php?f=48">the reported posts forum</a></td></tr><tr><td><table style="width: 100%" id="threadbits_forum_48_container"></table></td></tr><tr><td style="color: white">Most recent post in <a href="http://forums.frontier.co.uk/showthread.php?t=24499&goto=newpost">the moderation thread</a></td></tr><tr><td id="last_post_container"></td></tr></table></div></div></div>');

            stash.report_block.find('#threadbits_forum_48_container').load( 'http://forums.frontier.co.uk/forumdisplay.php?f=48 #threadbits_forum_48', function() {
                var $this = stash.report_block.find('#threadbits_forum_48');
                $this.children("tr").slice(5).remove();
            });
            stash.report_block.find('#last_post_container').load( 'http://forums.frontier.co.uk/showthread.php?t=24499&goto=newpost [id^=edit]:last', function() {
                stash.report_block.find('#last_post_container div.normal:nth(1)').attr( 'style', 'color: white' );
            });
        }
    },


    {
        match_pathname: '/showthread.php',
        match_elements: ['#lastpost'],
        callback: function(stash, pathname, params) {
            stash.report_block.insertAfter( '#posts' );
            stash.report_block.find('.page'             ).first().attr( 'style', $('.page'             ).first().attr('style') );
            stash.report_block.find('.page [align=left]').first().attr( 'style', $('.page [align=left]').first().attr('style') );

            var userid = params.u;

            $('table[id^=post]').each(
                function() {

                    var $username = $(this).find('a.bigusername'),
                        post_id    = this.id.substr( 4 ),
                        userid     = ( $username.attr("href") || '' ).split('?u=', 2)[1],
                        username   = $username.text()
                    ;

                    /*
                     * ADD "USER NOTES" popup
                     */
                    $(this).children( 'tbody' ).children( 'tr' ).last().find('.smallfont').first()
                        .before(
                            '<a style="float: right" href="/usernote.php?u=' + userid + '" class="view-user-notes">View User Notes</a><div style="float: right; width: 2ex; text-align: center"> - </div><a style="float: right" href="http://forums.frontier.co.uk/usernote.php?do=newnote&u=' + userid + '">Post New User Note</a>' +
                                (
                                    stash.watched_users.hasOwnProperty(userid)
                                        ? '<div style="float: right">' + stash.watchlist_html + '&nbsp;-&nbsp;</div>'
                                        : ''
                                )
                        )
                    ;

                    $('<tr><td class="vbmenu_option vbmenu_option_alink"><a href="http://api.stopforumspam.org/api?ip=' + $('img[alt=IP]', this).attr('title') + '&username=' + encodeURIComponent(username) + '&f=json">Search on StopForumSpam.com</a></td></tr>')
                        .insertAfter( $('#postmenu_'+post_id+'_menu tr').last() )
                        .find('td')
                        .mouseover(function() { this.className = 'vbmenu_hilite vbmenu_hilite_alink'; this.setAttribute( 'style', "cursor: pointer;" ); })
                        .mouseout (function() { this.className = 'vbmenu_option vbmenu_option_alink'; this.setAttribute( 'style', "cursor: default;" ); })
                        .find( 'a' ).click(function(event) {
                            stash.check_on_stopforumspam( $(this).attr('href') );
                            event.preventDefault();
                        });
                    ;

                });

            $('.view-user-notes').click(function(event) {
                $('<div>loading...</div>').replaceAll(this).load( this.href + ' [style="padding:0px 0px 6px 0px"]' );
                event.preventDefault();
            });

        }

    },

    /*
     * ADD "REPORT POSTS FORUM" extras
     */

    {
        match_pathname: '/showthread.php',
        match_elements: [ 'table.tborder a[href="forumdisplay.php?f=48"]', '#lastpost' ],
        callback: function(stash, pathname, params) {
            /** Try to counteract the unwanted scrolling when you load content with AJAX
             *
             */
            function fix_viewport_from_ajax_load(element) {
                if ( !element ) element = this;
                if ( element.getBoundingClientRect().top < 0 ) {
                    window.scrollBy( 0, $(element).outerHeight() );
                }
            }

            var newreply = $('a[href^=newreply]').eq(0),
                common_actions,
                posts = $('table[id^=post]'),
                user_notes = $('<div></div>').appendTo( posts.first().find('div[id^=post_message_]') ),
                reported_user = -1,
                reported_post = ( $('a[href^="http://forums.frontier.co.uk/showthread.php?p="]').first().attr( 'href' ) || '' ).split( '#post' )[1]
            ;

            posts.first().find( 'a[href^="http://forums.frontier.co.uk/member.php"]' ).each(function() {
                var userid = params.u;
                $(this).next('br').before('&nbsp; <a href="http://forums.frontier.co.uk/search.php?do=finduser&u='+userid+'">(find all posts by '+$(this).html()+')</a>');
                if ( reported_user != userid ) { // people sometimes report their own posts
                    reported_user = userid;
                    var notes =
                        $('<div style="border-left: 3px solid black; padding-left: 1em">' +
                          '<h1>Notes for ' + $(this).html() + '</h1>' +
                          ( stash.watched_users.hasOwnProperty(userid) ? watchlist_html : '' ) +
                          '<div class="activity"><img src="images/misc/progress.gif" alt="loading, please wait"></div>' +
                          '<div class="browsing-options"><a href="http://forums.frontier.co.uk/modcp/user.php?do=viewuser&u='+userid+'#ctrl_options[receivepm]">Checking browsing options...</a></div>' +
                          '<h2>Infractions for ' + $(this).html() + '</h2>' +
                          '<div class="infractions"><img src="images/misc/progress.gif" alt="loading, please wait"></div>' +
                          '<br>' +
                          '<div class="user-notes"><img src="images/misc/progress.gif" alt="loading, please wait"></div></div>'
                         )
                        .prependTo( user_notes )
                    ;
                    notes.find('.user-notes')
                        .load( this.getAttribute( 'href' ).replace( 'member', 'usernote' ) + ' [style="padding:0px 0px 6px 0px"]', fix_viewport_from_ajax_load );
                    ;
                    $.ajax({
                        url: 'http://forums.frontier.co.uk/modcp/user.php?do=viewuser&u=' + userid,
                        dataType: 'html',
                        success: function(html) {
                            html = $(html);
                            if ( html.find('#cpform').length ) { // not redirected to a login page
                                var message;
                                if ( html.find('#rb_1_options\\[receivepm\\]_31').is(':checked') )
                                    if ( html.find('#rb_1_options\\[emailonpm\\]_32').is(':checked') )
                                        if ( html.find('#rb_1_user\\[pmpopup\\]_33').is(':checked') )
                                            message = 'will be notified of private messages by popup and e-mail';
                                else
                                    message = 'will be notified of private messages by e-mail';
                                else
                                    if ( html.find('#rb_1_user\\[pmpopup\\]_33').is(':checked') )
                                        message = 'will be notified of private messages by popup';
                                else
                                    message = "will receive private messages, but won't be notified so probably won't see them";
                                else
                                    message = 'will not receive private messages';
                                notes.find('.browsing-options').html('<a href="http://forums.frontier.co.uk/modcp/user.php?do=viewuser&u='+userid+'#ctrl_options[receivepm]">Browsing options</a>: ' + message);
                            } else {
                                notes.find('.browsing-options').html('<a href="http://forums.frontier.co.uk/modcp/user.php?do=viewuser&u='+userid+'#ctrl_options[receivepm]">Log in to ModCP to check browsing options</a>');
                            }
                        }
                    });
                    $.ajax({
                        url: this.href,
                        dataType: 'html',
                        success: function(html) {
                            var $html = $(html),
                            $infractions = $html.find('#collapseobj_infractions'),
                            $activity    = $html.find('#activity_info')
                            ;

                            $infractions.removeAttr( 'id' );
                            if ( $infractions.find('tr').length > 1 ) {
                                $infractions
                                    .find('table').css({ 'border-collapse': 'collapse' })
                                    .find('tr').slice(0,1).remove()
                                ;
                                notes.find('.infractions').empty().append($infractions);
                            } else {
                                notes.find('.infractions').text('(no infractions)');
                            }

                            notes.find('.activity').empty().append($activity.removeClass('alt2'));

                            fix_viewport_from_ajax_load( this );
                        }
                    });

                }
            });

            if ( posts.length == 1 )
                common_actions = '<li><a href="' + newreply.attr( 'href' ) + '&template=take_post&template=report_take">take this report</a>';
            else if ( posts.eq(1).find('a.bigusername').attr('href') != $('a[href^="member.php"]').first().attr('href') )
                common_actions = '<li>talk to the report owner (' + posts.eq(1).find('a.bigusername').text() + ')';
            else if ( $('img[alt="Closed Thread"]').length ) {
                common_actions =
                    '<li><a href="http://forums.frontier.co.uk/forumdisplay.php?f=47">Check the infractions/warnings forum</a>' +
                    '<li><a href="/newreply.php?t=24499">Copy an appeal to the moderation log</a>' +
                    '<li><a href="/showgroups.php">Find an administrator</a> and PM them the post and user name if you want an infraction revoked'
            } else
                common_actions =
                '<li>Prod the user first:' +
                '<ul>' +
                '<li><a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+reported_user+'&template=masked_swearing&post_id=' + reported_post + '">send PM for masked swearing</a>' +
                '<li><a href="http://forums.frontier.co.uk/private.php?do=newpm&u='+reported_user+'&post_id=' + reported_post + '">send PM (no template)</a>' +
                '<li><a href="http://forums.frontier.co.uk/infraction.php?do=report&p=' + reported_post + '">Give infraction to post</a> (or <a href="http://forums.frontier.co.uk/infraction.php?do=report&u=' + reported_user + '">to the user</a>)' +
                '</ul>' +
                '<li>Fix the problem after prodding the user:' +
                '<ul>' +
                '<li><a href="http://forums.frontier.co.uk/editpost.php?do=editpost&p=' + reported_post + '&edit-reason=Removed%20masked%20swearing">Edit post and set reason to "Removed masked swearing"</a>' +
                '<li><a href="http://forums.frontier.co.uk/editpost.php?do=editpost&p=' + reported_post + '">Edit post</a>' +
                '</ul>' +
                '<li>Finally, update the records:' +
                '<ul>' +
                '<li><a href="' + newreply.attr( 'href' ) + '&template=take_post&template=report_update&status=closed&cb_openclose=1">close this report</a></span>' +
                '<li><a href="' + newreply.attr( 'href' ) + '&template=take_post&template=report_update&status=open">update this report</a>' +
                '<li><a href="http://forums.frontier.co.uk/usernote.php?do=newnote&u=' + reported_user + '">Add user note</a> (if not done automatically)' +
                '</ul>' +
                '<li>If in doubt, check the rulebook:' +
                '<ul>' +
                '<li><a href="http://forums.frontier.co.uk/showthread.php?p=779618#post779618">Why the order of actions is important</a>' +
                '<li><a href="http://forums.frontier.co.uk/showthread.php?t=18103">Forum Rules</a> (covers most issues)' +
                '<li><a href="https://www.frontier.co.uk/legal/terms/">Frontier Developments Terms of Service</a> (fallback for some rare problems) ' +
                '<li><a class="forum-rules" data-forum="65" href="http://forums.frontier.co.uk/showthread.php?t=38002">Groups Forum Rules</a>' +
                '<li><a class="forum-rules" data-forum="64" href="http://forums.frontier.co.uk/showthread.php?t=37996">Roleplaying Forum Rules</a> ' +
                '<li><a class="forum-rules" data-forum="34" href="http://forums.frontier.co.uk/showthread.php?t=4213">DDF rules and format</a>' +
                '<li><a class="forum-rules" data-forum="44" href="http://forums.frontier.co.uk/showthread.php?t=9201">Alpha Forum Rules & Guidelines</a>' +
                '</ul>'
            ;

            $('<div id="post-date"><img src="images/misc/progress.gif" alt="loading, please wait"></div>').prependTo(user_notes);

            posts.first().find( 'a[href^="http://forums.frontier.co.uk/showthread.php"]' ).each(function() {
                var post = this;
                $.ajax({
                    url: this.href,
                    dataType: 'html',
                    success: function(html) {
                        var $html = $(html);
                        if ( $html.find('img[alt="Closed Thread"]').length )
                            $(post).after( ' (this thread has now been closed)' );
                        $('.forum-rules')
                            .addClass('shade')
                            .filter('[data-forum=' + $html.find('.navbar a[href^="forumdisplay.php"]').last().attr('href').substr(19) + ']' )
                            .removeClass('shade').css({ 'font-weight': 'bold' })
                            .after( ' (post was in this forum)' )
                        ;
                        $html
                            .find( post.href.replace( /.*#post/, '#post_message_' ) ).siblings().find('a[href^="posthistory.php?"]').parent()
                            .prepend( 'Posted ' + $html.find( '#currentPost a[name^=post]' ).parent().text().replace( /\s*$/, ';' ) )
                            .appendTo( $('#post-date').empty() )
                        ;
                        fix_viewport_from_ajax_load( this );
                    }});
            });

            if ( posts.slice(1).find('#currentPost').length == 0 || posts.eq(1).find('a.bigusername').attr('href') != $('a[href^="member.php"]').first().attr('href') )
                $('<h1>Common actions</h1><ol>' + common_actions + '</ol>').insertAfter('#post-date');
            else
                $('<h1>Common actions</h1><ol>' + common_actions + '</ol>').appendTo( $('#currentPost').closest('table').find('[id^=post_message_]') );
        }

    },

    /*
     * REPORT PAGES
     */
    {
        match_pathname: '/report.php',
        match_elements: ['textarea'],
        callback: function(stash, pathname, params, textarea) {
            $(textarea).parent().append(
                '<div><b>Common messages:</b><ul>' +
                    '<li><a href="#set-reason">Masked swearing</a>' +
                    '</ul></div>'
            );
            $('a[href="#set-reason"]').click(function(event) {
                $(textarea).val( $(this).text() );
                event.preventDefault();
            });
        }
    }

);
